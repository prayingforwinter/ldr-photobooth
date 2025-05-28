#!/bin/bash

# Script to set up an Oracle Stream Analytics server and deploy a simple AI processing pipeline.

# Configuration
OSA_HOME="/opt/oracle/cep"  # Replace with your OSA installation directory
OSA_DOMAIN="MyDomain"
OSA_SERVER="AdminServer"
OSA_USER="weblogic"
OSA_PASSWORD="password" # Replace with your actual password
STREAM_NAME="VideoStream"
TOPIC_NAME="VideoStreamTopic"
AI_MODEL_URL="https://example.com/model.pt" # Replace with your AI model URL

# Helper functions
print_status() {
  echo -e "\e[34m[INFO] $1\e[0m"
}

print_error() {
  echo -e "\e[31m[ERROR] $1\e[0m"
}

# Check if OSA_HOME is set
if [ -z "$OSA_HOME" ]; then
  print_error "OSA_HOME is not set. Please set it to your Oracle Stream Analytics installation directory."
  exit 1
fi

# Check if OSA_HOME exists
if [ ! -d "$OSA_HOME" ]; then
  print_error "OSA_HOME directory does not exist: $OSA_HOME"
  exit 1
fi

# Set up environment
export JAVA_HOME=$(readlink -f $(which java) | sed "s:bin/java::")
export PATH=$OSA_HOME/common/bin:$PATH

# Start OSA server (optional - assuming it's already running or will be started separately)
# print_status "Starting Oracle Stream Analytics server..."
# $OSA_HOME/startWebLogic.sh

# Deploy the application (assuming it's already deployed or will be deployed separately)
# print_status "Deploying the application..."
# wlst.sh deployApplication.py

# Create Kafka topic (assuming Kafka is already set up)
print_status "Creating Kafka topic..."
kafka-topics.sh --create --topic $TOPIC_NAME --partitions 1 --replication-factor 1 --if-not-exists --zookeeper localhost:2181

# Create Python AI processing script (lightweight version)
print_status "Creating lightweight AI processing pipeline..."
curl -sSL https://raw.githubusercontent.com/your-repo/process_frame_lightweight.py > process_frame.py

# Or if you prefer to embed it directly:
# cat > process_frame.py << 'EOF'
# [content of the lightweight script above]
# EOF

# Download AI model (optional - if needed by the Python script)
print_status "Downloading AI model..."
curl -sSL $AI_MODEL_URL -o model.pt

# Create a simple producer script (example)
print_status "Creating a simple producer script..."
cat > producer.py << 'EOF'
from kafka import KafkaProducer
import time
import json

# Configuration
topic_name = "$TOPIC_NAME"
kafka_server = 'localhost:9092'

# Create Kafka producer
producer = KafkaProducer(bootstrap_servers=[kafka_server],
                         value_serializer=lambda x: json.dumps(x).encode('utf-8'))

# Simulate sending video frames
for i in range(10):
    frame_data = {'frame_id': i, 'timestamp': time.time(), 'data': 'dummy data'}
    producer.send(topic_name, frame_data)
    print(f"Sent frame: {i}")
    time.sleep(1)

# Close the producer
producer.close()
EOF

# Run the producer script (example)
print_status "Running the producer script..."
python producer.py

print_status "Setup complete!"
