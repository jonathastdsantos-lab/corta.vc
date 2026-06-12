#!/usr/bin/env python3
"""
detect-faces.py — Face detection para o Corta.vc
Usa YuNet (OpenCV 4.x DNN) para detectar rostos em frames extraídos do vídeo.
Saída: JSON com bounding boxes normalizados por segundo.

Uso:
  python3 detect-faces.py --frames /tmp/frames --out /tmp/faces.json
                          --video-w 1080 --video-h 1920
                          [--model /tmp/yunet.onnx]
                          [--confidence 0.6]
                          [--fps 1]
"""
import argparse
import json
import os
import sys
import glob

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--frames',     required=True,  help='Diretório com frames JPEG')
    parser.add_argument('--out',        required=True,  help='Arquivo JSON de saída')
    parser.add_argument('--video-w',    required=True,  type=int)
    parser.add_argument('--video-h',    required=True,  type=int)
    parser.add_argument('--model',      default='',     help='Caminho do modelo YuNet .onnx')
    parser.add_argument('--confidence', default=0.6,    type=float)
    parser.add_argument('--fps',        default=1,      type=int, help='Frames por segundo extraídos')
    args = parser.parse_args()

    try:
        import cv2
    except ImportError:
        print(json.dumps({'error': 'opencv-python não instalado', 'faces': []}))
        sys.exit(1)

    # Localiza modelo YuNet — tenta caminhos comuns se não especificado
    model_path = args.model
    if not model_path or not os.path.exists(model_path):
        candidates = [
            '/usr/share/opencv4/haarcascades/yunet.onnx',
            '/usr/local/lib/python3.*/dist-packages/cv2/data/face_detection_yunet_2023mar.onnx',
            os.path.join(os.path.dirname(__file__), 'yunet.onnx'),
            '/tmp/yunet.onnx',
        ]
        for c in candidates:
            expanded = glob.glob(c)
            if expanded and os.path.exists(expanded[0]):
                model_path = expanded[0]
                break

    results = []  # lista de { t: float, cx: float, cy: float, w: float, h: float, conf: float }

    # Ordena os frames por nome (frame_001.jpg, frame_002.jpg...)
    frame_files = sorted(glob.glob(os.path.join(args.frames, '*.jpg')))

    if not frame_files:
        print(json.dumps({'error': 'Nenhum frame encontrado', 'faces': []}))
        sys.exit(1)

    if model_path and os.path.exists(model_path):
        # ── YuNet via OpenCV FaceDetectorYN (melhor precisão) ──────
        try:
            detector = cv2.FaceDetectorYN.create(
                model=model_path,
                config='',
                input_size=(args.video_w, args.video_h),
                score_threshold=args.confidence,
                nms_threshold=0.3,
                top_k=5,
            )

            for idx, fpath in enumerate(frame_files):
                t = idx / args.fps  # timestamp em segundos
                img = cv2.imread(fpath)
                if img is None:
                    continue

                h, w = img.shape[:2]
                # Redimensiona para o tamanho esperado pelo modelo
                if w != args.video_w or h != args.video_h:
                    img = cv2.resize(img, (args.video_w, args.video_h))
                    detector.setInputSize((args.video_w, args.video_h))
                else:
                    detector.setInputSize((w, h))

                _, faces = detector.detect(img)

                if faces is not None and len(faces) > 0:
                    # Pega a face com maior score (falante principal)
                    best = max(faces, key=lambda f: f[14])  # índice 14 = score
                    x, y, bw, bh = best[0], best[1], best[2], best[3]
                    conf = float(best[14])

                    # Normaliza para [0,1]
                    results.append({
                        't':    round(t, 3),
                        'cx':   round((x + bw / 2) / args.video_w, 4),
                        'cy':   round((y + bh / 2) / args.video_h, 4),
                        'w':    round(bw / args.video_w, 4),
                        'h':    round(bh / args.video_h, 4),
                        'conf': round(conf, 3),
                    })
        except Exception as e:
            # Fallback para Haar Cascade se YuNet falhar
            model_path = ''
            results = []

    if not model_path or not os.path.exists(model_path):
        # ── Haar Cascade (fallback, sem modelo ONNX) ───────────────
        try:
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            cascade = cv2.CascadeClassifier(cascade_path)

            for idx, fpath in enumerate(frame_files):
                t = idx / args.fps
                img = cv2.imread(fpath)
                if img is None:
                    continue

                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                h, w = gray.shape[:2]
                faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))

                if len(faces) > 0:
                    # Maior face detectada
                    fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
                    results.append({
                        't':    round(t, 3),
                        'cx':   round((fx + fw / 2) / w, 4),
                        'cy':   round((fy + fh / 2) / h, 4),
                        'w':    round(fw / w, 4),
                        'h':    round(fh / h, 4),
                        'conf': 0.7,
                    })
        except Exception as e:
            print(json.dumps({'error': str(e), 'faces': []}))
            sys.exit(1)

    # Escreve resultado no arquivo JSON de saída
    output = {
        'total_frames': len(frame_files),
        'faces_found':  len(results),
        'video_w':      args.video_w,
        'video_h':      args.video_h,
        'faces':        results,
    }
    with open(args.out, 'w') as f:
        json.dump(output, f)

    print(json.dumps({'ok': True, 'faces_found': len(results)}))

if __name__ == '__main__':
    main()
