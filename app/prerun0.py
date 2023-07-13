import torch
import easyocr

if torch.cuda.is_available():
    cuda = True
else:
    cuda = False

lang_codes = []
f = open("languages.txt", "r")
for line in f:
    lang_codes.append(line.split("\t")[-1].strip())

for lang_code in lang_codes[:40]:
    try:
        bbox_detector = easyocr.Reader([lang_code], gpu=cuda, verbose=False)
    except:
        pass
