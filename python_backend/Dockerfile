FROM python:3.12-slim AS runtime

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# libgomp is XGBoost's OpenMP runtime; the wheel will not import without it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /usr/sbin/nologin engine

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src

# The fitted model ships *in the image*, so a release is atomic: the engine answers a
# forecast the moment it is up, with a model whose provenance is the commit that built
# it. The alternative - an empty artifacts dir and a volume - loses the model on every
# deploy here, because the workflow runs `docker system prune -af --volumes` and an
# artifact volume belonging to a stopped container is unused by that definition.
#
# `POST /train` still works at runtime and overwrites this copy for the life of the
# container; it just does not survive the next release, which is correct when the
# image is the source of truth.
COPY artifacts ./artifacts
# The metrics report the model was scored with, so `/model/metrics` answers from the
# first request rather than only after someone trains inside a container - which would
# not survive the next `docker system prune -af --volumes` anyway.
COPY outputs ./outputs

RUN mkdir -p artifacts outputs && chown -R engine:engine /app
USER engine

EXPOSE 8000

# Reports 503 while /api/training-data is unreachable, which is the state where this
# engine cannot answer a forecast either.
HEALTHCHECK --interval=30s --timeout=8s --start-period=25s --retries=3 \
  CMD python -c "import sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=6).status == 200 else 1)" || exit 1

CMD ["sh", "-c", "uvicorn src.api:app --host 0.0.0.0 --port ${ENGINE_PORT:-8000}"]
