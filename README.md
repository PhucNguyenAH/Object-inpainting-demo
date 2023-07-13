# Document

## Git clone

```console
git clone https://github.com/PhucNguyenAH/Object-inpainting-demo.git
```
## Download LaMa checkpoint
- Open https://disk.yandex.ru/d/EgqaSnLohjuzAg to download big-lama folder
- Move big-lama folder to object-inpainting-demo/app/
## Run project

```console
cd object-inpainting-demo
docker compose pull & docker compose up -d --build --force-recreate & docker system prune -f
```
