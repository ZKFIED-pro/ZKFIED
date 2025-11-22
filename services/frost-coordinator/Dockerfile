FROM rust:latest as builder

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
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /build/target/release/zkfied-frost-coordinator /app/

# Download Zcash proving parameters
RUN mkdir -p /root/.zcash-params && \
    cd /root/.zcash-params && \
    wget -q https://download.z.cash/downloads/sapling-spend.params && \
    wget -q https://download.z.cash/downloads/sapling-output.params && \
    echo "Downloaded Zcash proving parameters"

ENV PORT=3000
ENV DATABASE_URL=sqlite:///data/zkfied.db
ENV RUST_LOG=info
ENV ZCASH_PARAMS_DIR=/root/.zcash-params

EXPOSE 3000

VOLUME ["/data"]

CMD ["/app/zkfied-frost-coordinator"]
