run-https:
	cloudflared tunnel --url http://localhost:3000
run:
	sudo docker compose -f docker-compose.yml down
	sudo docker compose -f docker-compose.yml up --build

prod:
	sudo docker compose -f docker-compose.model-svr.yml down
	sudo docker compose -f docker-compose.model-svr.yml up --build -d
	sudo docker compose -f docker-compose.yml down
	sudo docker compose -f docker-compose.yml up --build -d
	curl http://localhost:8000/llm/api/pull -d '{"name": "gemma3:4b"}'
	cloudflared tunnel --url http://localhost:3000

down:
	sudo docker compose -f docker-compose.model-svr.amd.yml down
	sudo docker compose -f docker-compose.yml down