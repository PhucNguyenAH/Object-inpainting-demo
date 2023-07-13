#/bin/sh
docker-compose pull && docker-compose up -d --build --force-recreate && docker system prune -f