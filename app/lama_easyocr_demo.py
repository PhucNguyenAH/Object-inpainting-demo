import time
import pandas as pd
import numpy as np
import cv2
import yaml
import re
import pickle
from io import BytesIO, BufferedReader
import easyocr
from PIL import Image
import streamlit as st
from omegaconf import OmegaConf
from streamlit_drawable_canvas import st_canvas
from streamlit_option_menu import option_menu

import torch
from torch.utils.data._utils.collate import default_collate
import torch.nn as nn
from saicinpainting.training.trainers.default import DefaultInpaintingTrainingModule

org_time = 0
sub_time = 0
sub_image_org = None
sub_mask = None
mask2 = None
image = None
filename = None
newW = 450
newH = None
flag = False
flag_bbox = False
suggest_lang = None
cur_res = None
languages = []
lang_codes = []
stroke_color = "rgba(255,1,255,0.5)"
bg_color = "#eee"

st.set_page_config(layout="wide")

if torch.cuda.is_available():
    device = torch.device("cuda")
    cuda = True
else:
    device = torch.device("cpu")
    cuda = False

def ceil_modulo(x, mod):
    if x % mod == 0:
        return x
    return (x // mod + 1) * mod

def pad_img_to_modulo(img, mod):
    channels, height, width = img.shape
    out_height = ceil_modulo(height, mod)
    out_width = ceil_modulo(width, mod)
    return np.pad(img, ((0, 0), (0, out_height - height), (0, out_width - width)), mode='symmetric')

def move_to_device(obj, device):
    if isinstance(obj, nn.Module):
        return obj.to(device)
    if torch.is_tensor(obj):
        return obj.to(device)
    if isinstance(obj, (tuple, list)):
        return [move_to_device(el, device) for el in obj]
    if isinstance(obj, dict):
        return {name: move_to_device(val, device) for name, val in obj.items()}
    raise ValueError(f'Unexpected type {type(obj)}')

def get_training_model_class(kind):
    if kind == 'default':
        return DefaultInpaintingTrainingModule

    raise ValueError(f'Unknown trainer module {kind}')

def make_training_model(config):
    kind = config.training_model.kind
    kwargs = dict(config.training_model)
    kwargs.pop('kind')
    kwargs['use_ddp'] = config.trainer.kwargs.get('accelerator', None) == 'ddp'

    cls = get_training_model_class(kind)
    return cls(config, **kwargs)

def load_checkpoint(train_config, path, map_location='cuda', strict=True):
    model: torch.nn.Module = make_training_model(train_config)
    state = torch.load(path, map_location=map_location)
    model.load_state_dict(state['state_dict'], strict=strict)
    model.on_load_checkpoint(state)
    return model

def create_bbox(ocr_model,image,confidence,classifier=None):
    suggest_lang = None 
    
    bbox_ocr = []
    bounds = ocr_model.readtext(image)
    for bbox in bounds:
        if bbox[2]>confidence/100:
            new_bbox = bbox_sample.copy()
            new_bbox['left']=int(bbox[0][0][0])
            new_bbox['top']=int(bbox[0][0][1])
            new_bbox['width']=int(bbox[0][1][0] - bbox[0][0][0])
            new_bbox['height']=int(bbox[0][2][1] - bbox[0][0][1])
            sub_img = image[int(bbox[0][0][1]):int(bbox[0][2][1]),int(bbox[0][0][0]):int(bbox[0][1][0])]
            white_rect = np.ones(sub_img.shape, dtype=np.uint8) * 255
            white_rect[:,:, 1] = 1
            res = cv2.addWeighted(sub_img, 0.5, white_rect, 0.5, 1.0)
            image[int(bbox[0][0][1]):int(bbox[0][2][1]),int(bbox[0][0][0]):int(bbox[0][1][0])] = res
            bbox_ocr.append(new_bbox)

    return bbox_ocr,image,suggest_lang

def normalize(image):
    image = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
    image[image[:, :, 0] > 0, 0] = 255
    image[image[:, :, 0] > 0, 1] = 255
    image[image[:, :, 0] > 0, 2] = 255
    image = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    return image.astype('float32') / 255
    
def download_image(image, type):
    ret, img_enco = cv2.imencode(f".{type}", cv2.cvtColor(image, cv2.COLOR_BGR2RGB))  #numpy.ndarray
    srt_enco = img_enco.tobytes()  #bytes
    img_BytesIO = BytesIO(srt_enco) #_io.BytesIO
    return BufferedReader(img_BytesIO) #_io.BufferedReader

def inference(image, mask):
    batch = dict(image=image, mask=mask[None, ...])
    batch['unpad_to_size'] = batch['image'].shape[1:]
    batch['image'] = pad_img_to_modulo(batch['image'], 8)
    batch['mask'] = pad_img_to_modulo(batch['mask'], 8)
    batch = default_collate([batch])
    with torch.no_grad():
        batch = move_to_device(batch, device)
        batch = model(batch) 
        cur_res = batch["inpainted"][0].permute(1, 2, 0).detach().cpu().numpy()
        unpad_to_size = batch.get('unpad_to_size', None)
        if unpad_to_size is not None:
            orig_height, orig_width = unpad_to_size
            cur_res = cur_res[:orig_height, :orig_width]

    return np.clip(cur_res * 255, 0, 255).astype('uint8')

scol1, scol2 = st.sidebar.columns(2)
erase_btn = scol1.button("Erase", use_container_width=True)
autoErase_btn = scol2.button("Auto Erase", use_container_width=True)
m = st.markdown("""
    <style>
    div.stButton > button:first-child {
        background-color: #00cc00;color:white;font-size:20px;border-radius:10px 10px 10px 10px;
    }
    </style>""", unsafe_allow_html=True)

bg_image = st.sidebar.file_uploader("Upload image:", type=["png", "jpg", "jpeg"])

if bg_image is not None:
    image = np.array(Image.open(bg_image).convert("RGB"))
    H,W,_ = image.shape
    newH = int(newW*H/W)
    image = cv2.resize(image,(newW,newH), interpolation = cv2.INTER_AREA)
    image_org = image.copy()
    image = np.transpose(image, (2, 0, 1))
    image = image.astype('float32') / 255
    filename = bg_image.name
    mask = None
    
torch.cuda.empty_cache()

with open("big-lama/config.yaml", 'r') as f:
    train_config = OmegaConf.create(yaml.safe_load(f))

train_config.training_model.predict_only = True
train_config.visualizer.kind = 'noop'

checkpoint_path = "big-lama/models/best.ckpt"
if "model" not in st.session_state:
    model = load_checkpoint(train_config, checkpoint_path, strict=False, map_location='cpu')
    model.freeze()
    model.to(device)
    st.session_state.model = model
else:
    model = st.session_state.model
st.title("Text Removal Demo")
with st.sidebar:
    selected = option_menu(
        menu_title="Drawing style",
        options=["Brush","Rectangle", "Edit"],
        icons=["brush","bounding-box", "tools"],
        menu_icon="menu-app",
        default_index=0,
    )

if selected == "Brush":
    drawing_mode = "freedraw"
    stroke_width = st.sidebar.slider("Stroke width: ", 1, 100, 30)
elif selected == "Rectangle":
    drawing_mode = "rect"
    stroke_width = 1
elif selected == "Edit":
    stroke_width = 1
    drawing_mode = "transform"
    
confidence = st.sidebar.slider("Confidence level: ", 1, 100, 10)
f = open("languages.txt", "r")
for line in f:
    languages.append(line.split("\t")[0].strip())
    lang_codes.append(line.split("\t")[-1].strip())
lang_idx = st.sidebar.selectbox("Languages:", range(len(languages)), index=39, format_func=lambda x: languages[x])

language = languages[lang_idx]
lang_code = lang_codes[lang_idx]
if "initial_dict" not in st.session_state:
    with open('bbox_sample.pickle', 'rb') as handle:
        st.session_state.initial_dict = pickle.load(handle)
    st.session_state.initial_dict['objects'] = [st.session_state.initial_dict['objects'][0]]

if st.sidebar.button("Remove all marks", use_container_width=True) and "initial_dict" in st.session_state:
    st.session_state.initial_dict["objects"] = [st.session_state.initial_dict["objects"][0]]
    st.empty()

img_type = st.sidebar.radio("Output image type:",["jpg","png"],index=0,horizontal=True)
if image is not None:
    bbox_sample = st.session_state.initial_dict['objects'][0]
    # Create a canvas component
    col1, col2, col3 = st.columns(3)
    with col1:
        st.header("Original")
        if erase_btn:
            flag = True
        if autoErase_btn:
            flag_bbox = True
        
        if flag_bbox:
            bbox_detector = easyocr.Reader([lang_code], gpu=cuda)
            bbox_ocr, image_bg, _ = create_bbox(bbox_detector, image_org, confidence)
            for bbox in bbox_ocr:
                if bbox not in st.session_state.initial_dict["objects"]:
                    st.session_state.initial_dict["objects"].append(bbox)
        else:
            image_bg = image_org
        canvas_result = st_canvas(
            fill_color=stroke_color,
            stroke_width=stroke_width,
            stroke_color= stroke_color,
            background_color=bg_color,
            background_image=Image.fromarray(image_bg) if bg_image else None,
            update_streamlit=True,
            height=newH,
            width=newW,
            drawing_mode=drawing_mode,
            initial_drawing=st.session_state.initial_dict,
            key="canvas",
        )        
    with col2:
        # Do something interesting with the image data and paths
        if canvas_result.image_data is not None:
            if "mask" in st.session_state:
                mask_tmp = canvas_result.image_data.copy()
                mask_tmp = normalize(mask_tmp)
                mask = np.add(st.session_state.mask, mask_tmp) 
                mask[mask > 1] = 1.
                mask2 = np.subtract(mask,st.session_state.mask)
            else:
                mask = canvas_result.image_data.copy()
                mask = normalize(mask)
                mask2 = mask.copy()

            if flag or flag_bbox:
                start0 = time.time()
                cur_res = inference(image,mask)
                end0 = time.time()
                org_time = end0-start0
                st.session_state.img_res = cur_res
                st.session_state.mask = mask
            if "mask" in st.session_state:
                if np.array_equal(st.session_state.mask,mask):
                    cur_res = inference(image,mask)
                    st.session_state.img_res = cur_res
                    st.session_state.mask = mask
            st.header("Result")                
            if "img_res" in st.session_state:  
                st.text(f"Whole image time: {org_time}")
                st.image(st.session_state.img_res) 
                if img_type == "jpg":
                    img_BufferedReader = download_image(cv2.resize(st.session_state.img_res,(W,H), interpolation = cv2.INTER_AREA), type="jpg")
                    download_btn = st.sidebar.download_button("Download",data=img_BufferedReader, file_name="Result.jpg", mime="image/jpeg", use_container_width=True)
                elif img_type == "png":
                    img_BufferedReader = download_image(cv2.resize(st.session_state.img_res,(W,H), interpolation = cv2.INTER_AREA), type="png")
                    download_btn = st.sidebar.download_button("Download",data=img_BufferedReader, file_name="Result.png", mime="image/png", use_container_width=True)
            m = st.markdown("""
                <style>
                div.stDownloadButton > button:first-child {
                    background-color: #00cc00;color:white;font-size:20px;border-radius:10px 10px 10px 10px;
                }
                </style>""", unsafe_allow_html=True)    
    with col3:
        # Do something interesting with the image data and paths
        if canvas_result.image_data is not None:
            if 1. not in mask2:
                mask2 = mask.copy()
            coors = np.where(mask2 == 1)
            if min(coors[1])-100>0:
                xmin = min(coors[1])-100
            else:
                xmin=0
            if max(coors[1])+100<W:
                xmax = max(coors[1])+100
            else:
                xmax = W
            if min(coors[0])-100>0:
                ymin = min(coors[0])-100
            else:
                ymin=0
            if max(coors[0])+100<H:
                ymax = max(coors[0])+100
            else:
                ymax = H
            
            if flag or flag_bbox:
                if "img_res2" in st.session_state:
                    sub_image_org = st.session_state.img_res2[ymin:ymax,xmin:xmax]
                else:
                    sub_image_org = image_org[ymin:ymax,xmin:xmax]
                sub_image = np.transpose(sub_image_org, (2, 0, 1))
                sub_image = sub_image.astype('float32') / 255
                sub_mask = mask2[ymin:ymax,xmin:xmax]
                start1 = time.time()
                sub_cur_res = inference(sub_image,sub_mask)
                if "img_res2" in st.session_state:
                    cur_res2 = st.session_state.img_res2.copy()
                else:
                    cur_res2 = image_org
                cur_res2[ymin:ymax,xmin:xmax] = sub_cur_res
                end1 = time.time()
                sub_time = end1-start1
                st.session_state.img_res2 = cur_res2
            st.header("Result")                
            if "img_res" in st.session_state:  
                st.text(f"Cropped image time: {sub_time}")
                st.image(st.session_state.img_res2) 
            m = st.markdown("""
                <style>
                div.stDownloadButton > button:first-child {
                    background-color: #00cc00;color:white;font-size:20px;border-radius:10px 10px 10px 10px;
                }
                </style>""", unsafe_allow_html=True)
    with col1:
        st.header("Mask")
        if mask is not None:
            st.image(mask)
        if mask2 is not None:
            st.image(mask2)
        if sub_image_org is not None:
            st.image(sub_image_org)
        if sub_mask is not None:
            st.image(sub_mask)
        
        if canvas_result.json_data is not None:
            objects = pd.json_normalize(canvas_result.json_data["objects"]) # need to convert obj to str because PyArrow
            for col in objects.select_dtypes(include=['object']).columns:
                objects[col] = objects[col].astype("str")

            st.dataframe(objects)
    
torch.cuda.empty_cache()