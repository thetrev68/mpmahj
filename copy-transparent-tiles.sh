#!/bin/bash

# Create destination directory if it doesn't exist
mkdir -p apps/client/public/assets/tiles-transparent

# Mapping of source files to destination files
# Format: "source_file:destination_file"

# Cracks (Mans/Characters) - 0101-0109 → Mahjong_1m-9m
cp "apps/client/src/assets/0101一萬.svg" "apps/client/public/assets/tiles-transparent/Mahjong_1m.svg"
cp "apps/client/src/assets/0102二萬.svg" "apps/client/public/assets/tiles-transparent/Mahjong_2m.svg"
cp "apps/client/src/assets/0103三萬.svg" "apps/client/public/assets/tiles-transparent/Mahjong_3m.svg"
cp "apps/client/src/assets/0104四萬.svg" "apps/client/public/assets/tiles-transparent/Mahjong_4m.svg"
cp "apps/client/src/assets/0105五萬.svg" "apps/client/public/assets/tiles-transparent/Mahjong_5m.svg"
cp "apps/client/src/assets/0106六萬.svg" "apps/client/public/assets/tiles-transparent/Mahjong_6m.svg"
cp "apps/client/src/assets/0107七萬.svg" "apps/client/public/assets/tiles-transparent/Mahjong_7m.svg"
cp "apps/client/src/assets/0108八萬.svg" "apps/client/public/assets/tiles-transparent/Mahjong_8m.svg"
cp "apps/client/src/assets/0109九萬.svg" "apps/client/public/assets/tiles-transparent/Mahjong_9m.svg"

# Dots (Pins) - 0201-0209 → Mahjong_1p-9p
cp "apps/client/src/assets/0201一餅.svg" "apps/client/public/assets/tiles-transparent/Mahjong_1p.svg"
cp "apps/client/src/assets/0202二餅.svg" "apps/client/public/assets/tiles-transparent/Mahjong_2p.svg"
cp "apps/client/src/assets/0203三餅.svg" "apps/client/public/assets/tiles-transparent/Mahjong_3p.svg"
cp "apps/client/src/assets/0204四餅.svg" "apps/client/public/assets/tiles-transparent/Mahjong_4p.svg"
cp "apps/client/src/assets/0205五餅.svg" "apps/client/public/assets/tiles-transparent/Mahjong_5p.svg"
cp "apps/client/src/assets/0206六餅.svg" "apps/client/public/assets/tiles-transparent/Mahjong_6p.svg"
cp "apps/client/src/assets/0207七餅.svg" "apps/client/public/assets/tiles-transparent/Mahjong_7p.svg"
cp "apps/client/src/assets/0208八餅.svg" "apps/client/public/assets/tiles-transparent/Mahjong_8p.svg"
cp "apps/client/src/assets/0209九餅.svg" "apps/client/public/assets/tiles-transparent/Mahjong_9p.svg"

# Bams (Sous) - 0301-0309 → Mahjong_1s-9s
cp "apps/client/src/assets/0301一條.svg" "apps/client/public/assets/tiles-transparent/Mahjong_1s.svg"
cp "apps/client/src/assets/0302二條.svg" "apps/client/public/assets/tiles-transparent/Mahjong_2s.svg"
cp "apps/client/src/assets/0303三條.svg" "apps/client/public/assets/tiles-transparent/Mahjong_3s.svg"
cp "apps/client/src/assets/0304四條.svg" "apps/client/public/assets/tiles-transparent/Mahjong_4s.svg"
cp "apps/client/src/assets/0305五條.svg" "apps/client/public/assets/tiles-transparent/Mahjong_5s.svg"
cp "apps/client/src/assets/0306六條.svg" "apps/client/public/assets/tiles-transparent/Mahjong_6s.svg"
cp "apps/client/src/assets/0307七條.svg" "apps/client/public/assets/tiles-transparent/Mahjong_7s.svg"
cp "apps/client/src/assets/0308八條.svg" "apps/client/public/assets/tiles-transparent/Mahjong_8s.svg"
cp "apps/client/src/assets/0309九條.svg" "apps/client/public/assets/tiles-transparent/Mahjong_9s.svg"

# Winds (need East and West from somewhere)
# cp "apps/client/src/assets/0401東風.svg" "apps/client/public/assets/tiles-transparent/Mahjong_E.svg" # MISSING
# cp "apps/client/src/assets/0402西風.svg" "apps/client/public/assets/tiles-transparent/Mahjong_W.svg" # MISSING
cp "apps/client/src/assets/0403南風.svg" "apps/client/public/assets/tiles-transparent/Mahjong_S.svg"
cp "apps/client/src/assets/0404北風.svg" "apps/client/public/assets/tiles-transparent/Mahjong_N.svg"

# Dragons
cp "apps/client/src/assets/0406發.svg" "apps/client/public/assets/tiles-transparent/Mahjong_H.svg"  # Green Dragon
cp "apps/client/src/assets/0405中.svg" "apps/client/public/assets/tiles-transparent/Mahjong_R.svg"  # Red Dragon
cp "apps/client/src/assets/0407白.svg" "apps/client/public/assets/tiles-transparent/Mahjong_T.svg"  # White Dragon

# Flower - using Winter (0504冬.svg) as the generic flower
cp "apps/client/src/assets/0504冬.svg" "apps/client/public/assets/tiles-transparent/Mahjong_F_Winter.svg"

# Joker - MISSING, will need to use the one from current tiles

echo "✓ Copied all available transparent tiles"
echo "⚠ Missing: East Wind, West Wind, Joker"
echo "You'll need to either:"
echo "  1. Add East Wind (東), West Wind (西), and Joker SVGs to src/assets"
echo "  2. Keep using the current versions with backgrounds for those tiles"
