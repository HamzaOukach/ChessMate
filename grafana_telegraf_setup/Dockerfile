FROM alpine:3.19

RUN apk add --no-cache curl bash postgresql-client

COPY grafana_setup.sh /grafana_setup.sh

RUN chmod +x /grafana_setup.sh

ENTRYPOINT ["/bin/sh", "-c", "/grafana_setup.sh"]