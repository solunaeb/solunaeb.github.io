사진 넣는 곳 (GitHub 에는 원본이 올라가지 않고, 암호화된 data/photos 만 올라갑니다)

  album/   첫 번째 서랍 — 사진 앨범 (여러 장, 파일 이름 순서대로 넘겨 보기)
  torch/   두 번째 서랍 — 횃불 사진
  buldak/  세 번째 서랍 — 까르보 불닭볶음면 사진
  frame.png (또는 frame.jpg)  액자에 걸 사진 — 방에서는 도트로, 누르면 원본으로 보여요

파일 이름을 "01_첫 데이트.jpg" 처럼 지으면 "첫 데이트" 가 사진 아래 설명으로 나와요.
사진을 넣은 뒤  python tools/build_content.py  를 실행하세요.
(pip install pillow 를 해 두면 큰 사진을 자동으로 줄여서 용량을 아껴 줘요)
