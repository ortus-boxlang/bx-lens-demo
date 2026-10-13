# The demo on BoxLang MiniServer. Modules and jars are downloaded at start by start.sh and kept in the .cache volume.
FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip && rm -rf /var/lib/apt/lists/*
WORKDIR /demo
COPY . /demo
RUN chmod +x /demo/start.sh
ENV HOST=0.0.0.0 PORT=8085
# A published port reaches the container from the Docker network, which is not loopback. Allow loopback and private networks.
# This is for a demo on your own machine. Do not do this on a server other people can reach.
ENV LENS_ACCESS='["local","private"]'
EXPOSE 8085
CMD ["./start.sh"]
