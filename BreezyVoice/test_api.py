import requests
import json
from pathlib import Path
import sys
import time

def wait_for_server(base_url, max_retries=5, delay=2):
    """Wait for server to be ready"""
    for i in range(max_retries):
        try:
            response = requests.get(f"{base_url}/models")
            if response.status_code == 200:
                return True
        except requests.exceptions.ConnectionError:
            print(f"Server not ready, retrying in {delay} seconds... ({i+1}/{max_retries})")
            time.sleep(delay)
    return False

def test_api():
    base_url = "http://localhost:8999/v1"
    
    # Wait for server to be ready
    if not wait_for_server(base_url):
        print("Error: Could not connect to server. Make sure the API server is running:")
        print("python BreezyVoice/api.py")
        sys.exit(1)
    
    # Test models endpoint
    print("Testing /models endpoint...")
    try:
        start_time = time.time()
        models_response = requests.get(f"{base_url}/models")
        models_response.raise_for_status()  # Raise exception for non-200 status codes
        end_time = time.time()
        print(f"Models API response time: {(end_time - start_time):.2f} seconds")
        print(json.dumps(models_response.json(), indent=2))
    except requests.exceptions.RequestException as e:
        print(f"Error accessing /models endpoint: {e}")
        return
    
    # Test speech synthesis endpoint
    print("\nTesting /audio/speech endpoint...")
    speech_payload = {
        "input": "你好我是君善，很高興認識你",
        "speed": 1.0
    }
    
    try:
        start_time = time.time()
        speech_response = requests.post(f"{base_url}/audio/speech", json=speech_payload)
        speech_response.raise_for_status()
        end_time = time.time()
        print(f"Speech synthesis API response time: {(end_time - start_time):.2f} seconds")
        
        # Save the audio file
        output_path = Path("test_output.wav")
        output_path.write_bytes(speech_response.content)
        print(f"Audio saved to {output_path}")
    except requests.exceptions.RequestException as e:
        print(f"Error accessing /audio/speech endpoint: {e}")

if __name__ == "__main__":
    test_api() 