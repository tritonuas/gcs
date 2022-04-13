#!/bin/bash
sudo docker run -e MAV_DEVICE=serial:/dev/ttyUSB0 -e MAV_OUTPUT1=udp:192.168.1.5:14553 --device=/dev/ttyUSB0:/dev/ttyUSB0 tritonuas/hub

