# Dockerfile for KVS Streaming Container
# Based on AWS KVS Producer SDK for C++

FROM 546150905175.dkr.ecr.us-west-2.amazonaws.com/kinesis-video-producer-sdk-cpp-amazon-linux:latest

# Set working directory
WORKDIR /workspace

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set environment variables for KVS SDK paths
ENV LD_LIBRARY_PATH=/opt/awssdk/amazon-kinesis-video-streams-producer-sdk-cpp/kinesis-video-native-build/downloads/local/lib:$LD_LIBRARY_PATH
ENV PATH=/opt/awssdk/amazon-kinesis-video-streams-producer-sdk-cpp/kinesis-video-native-build/downloads/local/bin:$PATH
ENV GST_PLUGIN_PATH=/opt/awssdk/amazon-kinesis-video-streams-producer-sdk-cpp/kinesis-video-native-build/downloads/local/lib:$GST_PLUGIN_PATH

# Set default KVS stream configuration
ENV STREAM_NAME=dockerStream
ENV TCP_PORT=5000
ENV AWS_DEFAULT_REGION=ap-northeast-1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["kvs"]
