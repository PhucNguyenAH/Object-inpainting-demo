FROM node:18-alpine as npmbuild
COPY app app
RUN export NODE_OPTIONS=--openssl-legacy-provider && \
  cd app/streamlit_drawable_canvas/frontend && \
  npm install --force && \
  npm run build

FROM registry.gitlab.com/ycomm1/ml/image-ml/mlenv:latest
COPY app/bbox_sample.pickle app/bbox_sample.pickle
COPY app/lama_easyocr_demo.py app/lama_easyocr_demo.py
COPY app/setup.py app/setup.py 
COPY app/README.md app/README.md
COPY app/streamlit_drawable_canvas app/streamlit_drawable_canvas
COPY --from=npmbuild /app/streamlit_drawable_canvas/frontend/build /app/streamlit_drawable_canvas/frontend/build
RUN cd app && \
    conda run -n ocr pip install -e . --no-cache-dir
WORKDIR /app
ENTRYPOINT ["conda", "run", "-n", "ocr"]
CMD ["streamlit", "run", "lama_easyocr_demo.py", "--server.fileWatcherType", "none"]