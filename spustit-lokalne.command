#!/bin/zsh
cd "$(dirname "$0")"
(sleep 1 && open http://localhost:8000) &
echo "Hra běží na http://localhost:8000 – pro ukončení zavři toto okno."
python3 -m http.server 8000
