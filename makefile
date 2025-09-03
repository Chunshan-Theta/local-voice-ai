run-https:
	cloudflared tunnel --url http://localhost:3000
run:
	sudo docker-compose -f docker-compose.yml down
	sudo docker-compose -f docker-compose.yml up --build

prod:
	sudo docker-compose -f docker-compose.model-svr.amd.yml down
	sudo docker-compose -f docker-compose.model-svr.amd.yml up --build -d
	sudo docker-compose -f docker-compose.yml down
	sudo docker-compose -f docker-compose.yml up --build -d
	cloudflared tunnel --url http://localhost:3000

down:
	sudo docker-compose -f docker-compose.model-svr.amd.yml down
	sudo docker-compose -f docker-compose.yml down