run site:
	cloudflared tunnel --url http://localhost:3000
run frontend:
	sudo docker-compose -f docker-compose.yml down
	sudo docker-compose -f docker-compose.yml up --build