run-https:
	cloudflared tunnel --url http://localhost:3000
run:
	sudo docker-compose -f docker-compose.yml down
	sudo docker-compose -f docker-compose.yml up --build

prod:
	sudo docker-compose -f docker-compose.yml down
	sudo docker-compose -f docker-compose.yml up --build -d
	cloudflared tunnel --url http://localhost:3000