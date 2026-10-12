# RabbitMQ for Doreti on Helicarrier. The platform health-checks the service's main port over
# HTTP and maps whichever port opens first, but RabbitMQ speaks AMQP and Erlang's port mapper
# (4369) opens first. A tiny static HTTP server on 8080 starts before RabbitMQ to answer the check;
# the apps use AMQP on 5672 over the private network.
FROM rabbitmq:4.1-alpine
RUN apk add --no-cache busybox-extras \
 && mkdir -p /srv/health && echo ok > /srv/health/index.html
COPY start.sh /usr/local/bin/doreti-start.sh
RUN chmod +x /usr/local/bin/doreti-start.sh
EXPOSE 8080 5672
CMD ["/usr/local/bin/doreti-start.sh"]
