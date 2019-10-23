# Hub &middot; [![Build Status](https://travis-ci.com/tritonuas/hub.svg?token=BPP6sv3rYx9yar3Cqdmy&branch=master)](https://travis-ci.com/tritonuas/hub)

## Install

```
make dep
make install
```

## Ports and Stuff
Hub interface to houston currently runs on port `5000` or `5001`
To connect to hub from houston:  
If running from source
1. `netstat -tulpn`
2. Check if port 5000 and/or 5001 is running
3. Go to houston, input `127.0.0.1:5000`

If running from docker
1. `docker container ls`
2. Find the name of hub
3. `docker container inspect [name of hub]`
4. Find network, make sure it is on the same network as houston. If running houston from npm, make sure to expose port
i.e. `docker container run tritonuas/houston -p 5000:5000 -p 5001:5001`
5. If port is exposed, input `127.0.0.1:5000` to houston. Otherwise, put `[hub's ip address]:5000` 

## Test

```
make test
```


