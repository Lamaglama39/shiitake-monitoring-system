import json
import os
import boto3
from datetime import datetime, timedelta
from botocore.exceptions import ClientError

# Environment variables
KVS_STREAM_NAME = os.environ.get('KVS_STREAM_NAME')
REGION = os.environ.get('REGION', 'ap-northeast-1')

# AWS clients
kvs_client = boto3.client('kinesisvideo', region_name=REGION)

def handler(event, context):
    """
    Lambda handler for Kinesis Video Streams

    Supported paths:
    - /api/kvs/hls-url: Get HLS streaming URL for KVS
    - /api/kvs/stream-status: Check if KVS stream is active

    Query parameters:
    - stream: KVS stream name (for KVS endpoints)
    - mode: 'live' or 'on_demand' (for HLS URL)
    - start: ISO format timestamp (for on_demand mode)
    - end: ISO format timestamp (for on_demand mode)
    """
    try:
        # Parse path
        path = event.get('rawPath', event.get('path', ''))
        query_params = event.get('queryStringParameters', {}) or {}

        # Route to appropriate handler
        if path.endswith('/kvs/hls-url'):
            return get_kvs_hls_url(query_params)
        elif path.endswith('/kvs/stream-status'):
            return get_kvs_stream_status(query_params)

        return {
            'statusCode': 404,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Not found'
            })
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': str(e)
            })
        }


def get_kvs_hls_url(query_params):
    """Get HLS streaming URL for KVS stream"""
    stream_name = query_params.get('stream', KVS_STREAM_NAME)
    mode = query_params.get('mode', 'live')  # 'live' or 'on_demand'
    start_time_str = query_params.get('start')
    end_time_str = query_params.get('end')

    print(f"get_kvs_hls_url called with stream_name={stream_name}, mode={mode}")

    try:
        # Get HLS streaming endpoint
        print(f"Getting data endpoint for stream: {stream_name}")
        endpoint_response = kvs_client.get_data_endpoint(
            StreamName=stream_name,
            APIName='GET_HLS_STREAMING_SESSION_URL'
        )

        endpoint = endpoint_response['DataEndpoint']
        print(f"Data endpoint: {endpoint}")

        # Create archived media client
        kvs_archived_media_client = boto3.client(
            'kinesis-video-archived-media',
            endpoint_url=endpoint,
            region_name=REGION
        )

        # Prepare HLS request parameters
        hls_params = {
            'StreamName': stream_name,
            'Expires': 43200  # 12 hours
        }

        if mode == 'on_demand' and start_time_str and end_time_str:
            # On-demand playback with time range
            print(f"ON_DEMAND mode: start={start_time_str}, end={end_time_str}")
            start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
            end_time = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))

            hls_params['PlaybackMode'] = 'ON_DEMAND'
            hls_params['HLSFragmentSelector'] = {
                'FragmentSelectorType': 'SERVER_TIMESTAMP',
                'TimestampRange': {
                    'StartTimestamp': start_time,
                    'EndTimestamp': end_time
                }
            }
        else:
            # Live playback
            print("LIVE mode")
            hls_params['PlaybackMode'] = 'LIVE'
            hls_params['HLSFragmentSelector'] = {
                'FragmentSelectorType': 'SERVER_TIMESTAMP'
            }

        print(f"Requesting HLS URL with params: {hls_params}")

        # Get HLS streaming session URL
        hls_response = kvs_archived_media_client.get_hls_streaming_session_url(**hls_params)

        print(f"Successfully got HLS URL")

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'hlsUrl': hls_response['HLSStreamingSessionURL'],
                'streamName': stream_name,
                'mode': mode,
                'expiresIn': 43200
            })
        }

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        print(f"KVS HLS ClientError: {error_code} - {error_message}")
        import traceback
        traceback.print_exc()

        if error_code == 'ResourceNotFoundException':
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': f'Stream not found: {stream_name}',
                    'details': error_message
                })
            }

        # Return error details to client
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': error_code,
                'message': error_message,
                'streamName': stream_name
            })
        }

    except Exception as e:
        print(f"KVS HLS Error: {str(e)}")
        import traceback
        traceback.print_exc()

        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }


def get_kvs_stream_status(query_params):
    """Check if KVS stream is active"""
    stream_name = query_params.get('stream', KVS_STREAM_NAME)

    try:
        # Describe stream to check if it exists and is active
        response = kvs_client.describe_stream(
            StreamName=stream_name
        )

        stream_info = response['StreamInfo']
        is_active = stream_info['Status'] == 'ACTIVE'

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'active': is_active,
                'streamName': stream_name,
                'status': stream_info['Status'],
                'creationTime': stream_info['CreationTime'].isoformat() if 'CreationTime' in stream_info else None
            })
        }

    except ClientError as e:
        error_code = e.response['Error']['Code']

        if error_code == 'ResourceNotFoundException':
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'active': False,
                    'streamName': stream_name,
                    'error': 'Stream not found'
                })
            }

        raise

    except Exception as e:
        print(f"Stream status error: {str(e)}")
        raise
