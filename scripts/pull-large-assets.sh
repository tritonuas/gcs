#!/bin/bash

# Move current directory so we can use relative file paths to where this script is located
parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$parent_path"

wget --no-check-certificate 'https://docs.google.com/uc?export=download&id=1u8EYuGkd-QekLDBO6k8SF5XN4_o-cOUU' -O '../static/videos/familyguy.mp4'
wget --no-check-certificate 'https://docs.google.com/uc?export=download&id=1OJZh1qdNypbKKG1C219WU2UgaEfO0Bsj' -O '../static/videos/subway.mp4'
wget --no-check-certificate 'https://docs.google.com/uc?export=download&id=1-QOoGsjG6gKJCnOucw2UBw2N33fW1fV3' -O '../static/music/intense.webm'
wget --no-check-certificate 'https://docs.google.com/uc?export=download&id=1Tbyn3OosYyTL_r9liVZHYz-jMwexxB50' -O '../static/music/blow.wav'
wget --no-check-certificate 'https://docs.google.com/uc?export=download&id=1RQU-4GU4VPaqMq5zSkVnJzTimaMzQBe1' -O '../static/music/normal.webm'
wget --no-check-certificate 'https://docs.google.com/uc?export=download&id=1HBwqcHz9pQYBhHYJP6YE88r4pISUcZFM' -O '../static/music/title.webm'
wget --no-check-certificate 'https://docs.google.com/uc?export=download&id=19hbJJnGJK5UoxraZxu6V15KucwhOamVr' -O '../static/music/drop.wav'