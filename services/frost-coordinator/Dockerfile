FROM rust:1-bookworm as builder

ARG CACHEBUST=1

WORKDIR /build

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY services/frost-coordinator/Cargo.toml services/frost-coordinator/Cargo.lock ./
RUN echo "Cache bust: $CACHEBUST"
COPY services/frost-coordinator/src ./src
COPY services/frost-coordinator/migrations ./migrations

RUN cargo build --release --bin zkfied-frost-coordinator

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /build/target/release/zkfied-frost-coordinator /app/

RUN mkdir -p /root/.zcash-params && \
    cd /root/.zcash-params && \
    wget -q https://download.z.cash/downloads/sapling-spend.params && \
    wget -q https://download.z.cash/downloads/sapling-output.params && \
    echo "Downloaded Zcash proving parameters"

RUN wget -q https://dist.ipfs.tech/kubo/v0.25.0/kubo_v0.25.0_linux-amd64.tar.gz && \
    tar -xzf kubo_v0.25.0_linux-amd64.tar.gz && \
    cd kubo && \
    bash install.sh && \
    cd .. && \
    rm -rf kubo kubo_v0.25.0_linux-amd64.tar.gz && \
    ipfs init --profile=server && \
    ipfs config Addresses.Gateway /ip4/127.0.0.1/tcp/8081 && \
    ipfs config Addresses.API /ip4/127.0.0.1/tcp/5001 && \
    echo "IPFS initialized and configured"

ENV PORT=8080
ENV DATABASE_URL=sqlite:///data/zkfied.db
ENV RUST_LOG=info
ENV ZCASH_PARAMS_DIR=/root/.zcash-params
ENV IPFS_PATH=/root/.ipfs

EXPOSE 8080

VOLUME ["/data"]

RUN echo '#!/bin/bash\nset -e\nipfs daemon --offline --no-gateway &\nIPFS_PID=$!\nsleep 3\nexec /app/zkfied-frost-coordinator' > /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
