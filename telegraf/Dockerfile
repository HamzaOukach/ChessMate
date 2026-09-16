FROM telegraf:1.35.2

USER root

COPY custom-entrypoint.sh /custom-entrypoint.sh
COPY telegraf.conf /telegraf.conf
RUN chmod +x /custom-entrypoint.sh

ENTRYPOINT ["/custom-entrypoint.sh"]