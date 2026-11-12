FROM python:3.12-slim-bookworm AS cad-build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential pkg-config libpcre2-dev zlib1g-dev curl ca-certificates xz-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /build
RUN curl --fail --location --retry 3 https://ftp.gnu.org/gnu/libredwg/libredwg-0.13.4.tar.xz -o source.tar.xz \
 && echo '7e153ea4dac4cbf3dc9c50b9ef7a5604e09cdd4c5520bcf8017877bbe1422cd5  source.tar.xz' | sha256sum -c - \
 && tar -xf source.tar.xz
COPY tools/cad/libredwg-0.13.4-ru.patch /build/ru.patch
WORKDIR /build/libredwg-0.13.4
RUN patch -p1 < /build/ru.patch \
 && ./configure --prefix=/opt/libredwg --disable-bindings --disable-docs --disable-python --disable-shared \
 && make -j2 && make install \
 && cp examples/dwgadd /opt/libredwg/bin/dwgadd-ru

FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends fonts-liberation libpcre2-8-0 zlib1g \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 10001 yellow && useradd --uid 10001 --gid yellow --no-create-home yellow
WORKDIR /app
COPY deployment/drawings/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=cad-build /opt/libredwg /opt/libredwg
COPY interconnect_documents /app/interconnect_documents
COPY data/interconnects/dkc-tml.json /app/data/interconnects/dkc-tml.json
COPY deployment/drawings/server.py deployment/drawings/smoke.py /app/
ENV YELLOW_CAD_BIN=/opt/libredwg/bin \
    YELLOW_DRAWING_FONT=/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf \
    PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
USER yellow
RUN python smoke.py
EXPOSE 8080
CMD ["python", "server.py"]
