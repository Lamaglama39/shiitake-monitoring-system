#!/usr/bin/env python3
"""
Camera capture with YOLO detection streaming to KVS via GStreamer

This script captures video from a camera, runs YOLO object detection,
and streams the processed video to Kinesis Video Streams via GStreamer.
"""

import argparse
import cv2
import numpy as np
import time
import sys
from pathlib import Path
from ultralytics import YOLO

# GStreamer imports
import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst, GLib


class YOLOStreamProcessor:
    def __init__(self, model_path, camera_index=0, width=1280, height=720,
                 conf_threshold=0.5, tcp_host='127.0.0.1', tcp_port=5000,
                 yolo_interval=1, bitrate=1500, keyframe_interval=90):
        """
        Initialize YOLO stream processor

        Args:
            model_path: Path to YOLO model (.pt file)
            camera_index: Camera device index
            width: Frame width
            height: Frame height
            conf_threshold: YOLO confidence threshold
            tcp_host: TCP server host
            tcp_port: TCP server port
            yolo_interval: Process YOLO every N frames (1=every frame, 2=every other frame, etc.)
            bitrate: Video bitrate in kbps (default: 1500)
            keyframe_interval: Keyframe interval in frames (default: 90 = 3sec at 30fps)
        """
        # Initialize GStreamer
        Gst.init(None)

        # Load YOLO model
        print(f"Loading YOLO model from: {model_path}")
        self.model = YOLO(model_path)

        # Camera settings
        self.camera_index = camera_index
        self.width = width
        self.height = height
        self.conf_threshold = conf_threshold

        # TCP settings
        self.tcp_host = tcp_host
        self.tcp_port = tcp_port

        # YOLO processing settings
        self.yolo_interval = yolo_interval
        self.last_detection_frame = None
        self.last_detections = 0

        # Video encoding settings
        self.bitrate = bitrate
        self.keyframe_interval = keyframe_interval

        # Initialize camera
        self.cap = None
        self.pipeline = None
        self.running = False

        # Statistics
        self.frame_count = 0
        self.fps = 0
        self.last_fps_time = time.time()

        # Timestamp tracking for GStreamer
        self.start_time = None
        self.frame_duration = int(Gst.SECOND / 30)  # 30 FPS in nanoseconds

    def initialize_camera(self):
        """Initialize camera capture"""
        print(f"Opening camera {self.camera_index}")
        self.cap = cv2.VideoCapture(self.camera_index)

        if not self.cap.isOpened():
            raise RuntimeError(f"Failed to open camera {self.camera_index}")

        # Set camera properties
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        self.cap.set(cv2.CAP_PROP_FPS, 30)

        # Get actual camera properties
        actual_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        actual_fps = self.cap.get(cv2.CAP_PROP_FPS)

        print(f"Camera initialized: {actual_width}x{actual_height} @ {actual_fps}fps")

        return actual_width, actual_height

    def create_gstreamer_pipeline(self):
        """Create GStreamer pipeline for TCP streaming"""
        # Optimized pipeline for KVS streaming
        # Fragment duration = keyframe_interval / fps
        fragment_duration_sec = self.keyframe_interval / 30.0

        pipeline_str = (
            f"appsrc name=source is-live=true format=time "
            f"caps=video/x-raw,format=BGR,width={self.width},height={self.height},framerate=30/1 ! "
            f"videoconvert ! "
            f"video/x-raw,width={self.width},height={self.height} ! "
            f"x264enc tune=zerolatency speed-preset=ultrafast "
            f"key-int-max={self.keyframe_interval} bitrate={self.bitrate} bframes=0 ! "
            f"gdppay ! "
            f"tcpserversink host={self.tcp_host} port={self.tcp_port} sync=false"
        )

        print(f"Video encoding settings:")
        print(f"  Bitrate: {self.bitrate} kbps")
        print(f"  Keyframe interval: {self.keyframe_interval} frames ({fragment_duration_sec:.1f} sec)")
        print(f"  Expected fragment duration: ~{fragment_duration_sec:.1f} seconds")

        print(f"Creating GStreamer pipeline: {pipeline_str}")
        self.pipeline = Gst.parse_launch(pipeline_str)
        self.appsrc = self.pipeline.get_by_name('source')

        # Start pipeline
        ret = self.pipeline.set_state(Gst.State.PLAYING)
        if ret == Gst.StateChangeReturn.FAILURE:
            raise RuntimeError("Failed to start GStreamer pipeline")

        print(f"GStreamer pipeline started, streaming to {self.tcp_host}:{self.tcp_port}")

    def process_frame(self, frame):
        """
        Process frame with YOLO detection

        Args:
            frame: Input frame (BGR format)

        Returns:
            Processed frame with bounding boxes
        """
        # Run YOLO inference
        results = self.model.predict(
            source=frame,
            conf=self.conf_threshold,
            verbose=False,
            stream=False
        )

        # Draw results on frame
        annotated_frame = results[0].plot()

        # Get detection count
        detections = len(results[0].boxes)

        return annotated_frame, detections

    def calculate_fps(self):
        """Calculate and update FPS"""
        self.frame_count += 1
        current_time = time.time()
        elapsed = current_time - self.last_fps_time

        if elapsed >= 1.0:
            self.fps = self.frame_count / elapsed
            self.frame_count = 0
            self.last_fps_time = current_time

        return self.fps

    def push_frame_to_gstreamer(self, frame, frame_number):
        """Push frame to GStreamer pipeline with proper timestamp"""
        # Initialize start time on first frame
        if self.start_time is None:
            self.start_time = time.time()

        # Convert frame to GStreamer buffer
        data = frame.tobytes()
        buf = Gst.Buffer.new_allocate(None, len(data), None)
        buf.fill(0, data)

        # Set timestamps for proper KVS fragment generation
        # PTS (Presentation Timestamp): when the frame should be displayed
        # DTS (Decode Timestamp): when the frame should be decoded
        timestamp = frame_number * self.frame_duration
        buf.pts = timestamp
        buf.dts = timestamp
        buf.duration = self.frame_duration

        # Push buffer to appsrc
        ret = self.appsrc.emit('push-buffer', buf)

        if ret != Gst.FlowReturn.OK:
            print(f"Error pushing buffer: {ret}")
            return False

        return True

    def run(self):
        """Main processing loop"""
        try:
            # Initialize camera
            actual_width, actual_height = self.initialize_camera()

            # Update dimensions if different from requested
            if actual_width != self.width or actual_height != self.height:
                print(f"Updating dimensions to actual camera resolution: {actual_width}x{actual_height}")
                self.width = actual_width
                self.height = actual_height

            # Create GStreamer pipeline
            self.create_gstreamer_pipeline()

            print("\n=== Starting YOLO Stream Processing ===")
            print(f"Model: {self.model}")
            print(f"Confidence threshold: {self.conf_threshold}")
            print(f"Resolution: {self.width}x{self.height}")
            print(f"Streaming to: {self.tcp_host}:{self.tcp_port}")
            print("Press Ctrl+C to stop\n")

            self.running = True
            stream_frame_number = 0

            while self.running:
                # Capture frame
                ret, frame = self.cap.read()
                if not ret:
                    print("Failed to capture frame")
                    break

                # Resize if needed
                if frame.shape[1] != self.width or frame.shape[0] != self.height:
                    frame = cv2.resize(frame, (self.width, self.height))

                # Process with YOLO only every N frames for better performance
                if stream_frame_number % self.yolo_interval == 0:
                    processed_frame, detections = self.process_frame(frame)
                    self.last_detection_frame = processed_frame.copy()
                    self.last_detections = detections
                else:
                    # Use last detection result
                    processed_frame = self.last_detection_frame if self.last_detection_frame is not None else frame
                    detections = self.last_detections

                # Calculate FPS
                fps = self.calculate_fps()

                # Add FPS and detection info to frame
                info_text = f"FPS: {fps:.1f} | Detections: {detections}"
                cv2.putText(
                    processed_frame,
                    info_text,
                    (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2
                )

                # Push to GStreamer with frame number for timestamp
                if not self.push_frame_to_gstreamer(processed_frame, stream_frame_number):
                    print("Failed to push frame to GStreamer")
                    break

                stream_frame_number += 1

                # Print status every second
                if self.frame_count % 30 == 0:
                    print(f"Streaming... FPS: {fps:.1f}, Detections: {detections}, Frames: {stream_frame_number}")

        except KeyboardInterrupt:
            print("\nStopping stream...")

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()

        finally:
            self.cleanup()

    def cleanup(self):
        """Cleanup resources"""
        print("Cleaning up...")
        self.running = False

        if self.cap is not None:
            self.cap.release()

        if self.pipeline is not None:
            self.pipeline.set_state(Gst.State.NULL)

        print("Cleanup complete")


def main():
    parser = argparse.ArgumentParser(
        description='Stream camera with YOLO detection to KVS via GStreamer'
    )
    parser.add_argument(
        '--model',
        type=str,
        default='../../model-v3/runs/detect/model-v3_train/weights/best.pt',
        help='Path to YOLO model file'
    )
    parser.add_argument(
        '--camera',
        type=int,
        default=0,
        help='Camera device index (default: 0)'
    )
    parser.add_argument(
        '--width',
        type=int,
        default=1280,
        help='Frame width (default: 1280)'
    )
    parser.add_argument(
        '--height',
        type=int,
        default=720,
        help='Frame height (default: 720)'
    )
    parser.add_argument(
        '--conf',
        type=float,
        default=0.5,
        help='YOLO confidence threshold (default: 0.5)'
    )
    parser.add_argument(
        '--host',
        type=str,
        default='0.0.0.0', # <-- 修正
        help='TCP server host (default: 0.0.0.0)'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=5000,
        help='TCP server port (default: 5000)'
    )
    parser.add_argument(
        '--yolo-interval',
        type=int,
        default=3,
        help='Process YOLO every N frames for better FPS (default: 3, 1=every frame)'
    )
    parser.add_argument(
        '--bitrate',
        type=int,
        default=1500,
        help='Video bitrate in kbps (default: 1500, recommended 720p: 1500-3000)'
    )
    parser.add_argument(
        '--keyframe-interval',
        type=int,
        default=90,
        help='Keyframe interval in frames (default: 90 = 3sec at 30fps, affects KVS fragment duration)'
    )

    args = parser.parse_args()

    # Check if model exists
    model_path = Path(args.model)
    if not model_path.exists():
        print(f"Error: Model file not found: {args.model}")
        sys.exit(1)

    # Create processor
    processor = YOLOStreamProcessor(
        model_path=str(model_path),
        camera_index=args.camera,
        width=args.width,
        height=args.height,
        conf_threshold=args.conf,
        tcp_host=args.host,
        tcp_port=args.port,
        yolo_interval=args.yolo_interval,
        bitrate=args.bitrate,
        keyframe_interval=args.keyframe_interval
    )

    # Run
    processor.run()


if __name__ == '__main__':
    main()
