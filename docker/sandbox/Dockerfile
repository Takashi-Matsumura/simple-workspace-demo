FROM ubuntu:24.04

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      bash \
      curl \
      vim \
      git \
      jq \
      iputils-ping \
      ca-certificates \
      locales \
      tzdata \
 && locale-gen en_US.UTF-8 \
 && update-locale LANG=en_US.UTF-8 \
 && rm -rf /var/lib/apt/lists/*

ENV LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    TERM=xterm-256color

WORKDIR /root

CMD ["sleep", "infinity"]
