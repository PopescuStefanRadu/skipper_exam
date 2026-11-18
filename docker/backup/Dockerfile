# Nightly database backups and restore (backup.sh), for production.
FROM postgres:17.2
COPY backup.sh /usr/local/bin/backup.sh
ENTRYPOINT ["backup.sh"]
CMD ["daily"]
