# Document

## Git clone

```console
git clone https://github.com/PhucNguyenAH/Object-inpainting-demo.git
```
## Download LaMa checkpoint
- Open https://drive.google.com/drive/folders/1hMJxz6Pjo759MvTHOkcJYIi4sXyXASf1?usp=sharing to download checkpoints folder
- Move big-lama folder to object-inpainting-demo/app/
## Run project

```console
cd object-inpainting-demo
docker compose pull & docker compose up -d --build --force-recreate & docker system prune -f
```
if Error response from daemon: could not select device driver "nvidia" with capabilities: [[gpu]]

$ distribution=$(. /etc/os-release;echo $ID$VERSION_ID)       && curl -s -L https://nvidia.github.io/libnvidia-container/gpgkey | sudo apt-key add -       && curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

$ sudo apt-get update

$ sudo apt-get install -y nvidia-docker2

$ sudo systemctl restart docker
