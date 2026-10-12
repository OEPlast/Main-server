#!/bin/sh
# Health endpoint first (busybox httpd backgrounds itself), then RabbitMQ in the foreground.
busybox-extras httpd -p 8080 -h /srv/health
exec docker-entrypoint.sh rabbitmq-server
