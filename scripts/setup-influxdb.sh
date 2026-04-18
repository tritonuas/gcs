#!/usr/bin/env bash
influx setup \
  --bucket mavlink \
  --org TritonUAS \
  --token influxdbToken \
  --username tritons \
  --password tritonuas \
  --host http://localhost:8086 \
  --force
