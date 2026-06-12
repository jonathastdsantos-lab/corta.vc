#!/usr/bin/env python3
"""
detect-faces.py — Face detection para Corta.vc
Detecta a face principal em cada frame (1fps) extraído do vídeo.

Detector priority:
  1. YuNet via cv2.FaceDetectorYN (OpenCV >= 4.8, model ONNX de 1MB — mais preciso)
  2. Haar Cascade frontal (built-in OpenCV — fallback sem modelo externo)

Saída: arquivo JSON com bounding boxes normalizados [0,1] por segundo.

Uso:
  python3 detect-faces.py
    --frames   /tmp/frames      # dir com f0001.jpg, f0002.jpg...
    --out      /tmp/faces.json  # onde escrever o resultado
    --video-w  1080
    --video-h  1920
    [--model   /tmp/yunet.onnx] # opcional
    [--confidence 0.50]
    [--fps 1]
"""

import argparse
import glob
import json
import os
import sys

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--frames',      required=True)
    p.add_argument('--out',         required=True)
    p.add_argument('--video-w',     required=True, type=int)
    p.add_argument('--video-h',     required=True, type=int)
    p.add_argument('--model',       default='')
    p.add_argument('--confidence',  default=0.50,  type=float)
    p.add_argument('--fps',         default=1,     type=int)
    args = p.parse_args()

    try:
        import cv2
    except ImportError:
        _write(args.out, {'error': 'opencv-python não instalado', 'faces': [], 'faces_found': 0, 'total_frames': 0})
        sys.exit(0)

    frame_files = sorted(glob.glob(os.path.join(args.frames, '*.jpg')))
    if not frame_files:
        _write(args.out, {'error': 'Nenhum frame encontrado', 'faces': [], 'faces_found': 0, 'total_frames': 0})
        sys.exit(0)

    # Tenta localizar o modelo YuNet se não especificado
    model_path = _resolve_model(args.model, cv2)

    faces = []

    if model_path:
        faces = _detect_yunet(frame_files, args, cv2, model_path)

    # Fallback: Haar Cascade
    if not faces:
        faces = _detect_haar(frame_files, args, cv2)

    result = {
        'total_frames': len(frame_files),
        'faces_found':  len(faces),
        'video_w':      args.video_w,
        'video_h':      args.video_h,
        'faces':        faces,
    }
    _write(args.out, result)
    # stdout: resumo legível pelo processo pai
    print(json.dumps({'ok': True, 'faces_found': len(faces), 'total_frames': len(frame_files)}))


def _resolve_model(explicit_path, cv2):
    """Localiza o arquivo ONNX do YuNet em caminhos comuns."""
    if explicit_path and os.path.exists(explicit_path):
        return explicit_path

    candidates = [
        '/tmp/yunet.onnx',
        os.path.join(os.path.dirname(__file__), 'yunet.onnx'),
        # OpenCV data dir (pode variar por instalação)
    ]
    # Tenta via cv2.data (presente em opencv-contrib e algumas distros)
    try:
        data_dir = cv2.data.haarcascades.replace('haarcascades/', '')
        candidates.insert(0, os.path.join(data_dir, 'face_detection_yunet_2023mar.onnx'))
    except Exception:
        pass

    for c in candidates:
        expanded = glob.glob(c)
        found = expanded[0] if expanded else (c if os.path.exists(c) else None)
        if found and os.path.exists(found):
            return found
    return None


def _detect_yunet(frame_files, args, cv2, model_path):
    """Detecção com YuNet (mais preciso, requer modelo ONNX)."""
    try:
        # Lê um frame para descobrir dimensões reais
        sample = cv2.imread(frame_files[0])
        if sample is None:
            return []
        fh, fw = sample.shape[:2]

        detector = cv2.FaceDetectorYN.create(
            model=model_path,
            config='',
            input_size=(fw, fh),
            score_threshold=args.confidence,
            nms_threshold=0.30,
            top_k=5,
        )

        results = []
        for idx, fpath in enumerate(frame_files):
            t = idx / args.fps
            img = cv2.imread(fpath)
            if img is None:
                continue
            h, w = img.shape[:2]

            # Redimensiona se necessário
            if w != fw or h != fh:
                img = cv2.resize(img, (fw, fh))
                detector.setInputSize((fw, fh))

            _, faces = detector.detect(img)
            if faces is None or len(faces) == 0:
                continue

            # Face com maior score (índice 14 = confidence no YuNet)
            best = max(faces, key=lambda f: float(f[14]))
            x, y, bw, bh = float(best[0]), float(best[1]), float(best[2]), float(best[3])
            conf = float(best[14])

            # Converte para coordenadas do vídeo original (args.video_w/h)
            scale_x = args.video_w / fw
            scale_y = args.video_h / fh

            results.append({
                't':    round(t, 3),
                'cx':   round((x + bw / 2) * scale_x / args.video_w, 4),
                'cy':   round((y + bh / 2) * scale_y / args.video_h, 4),
                'fw':   round(bw * scale_x / args.video_w, 4),
                'fh':   round(bh * scale_y / args.video_h, 4),
                'conf': round(conf, 3),
            })

        return results

    except Exception as e:
        print(f'YuNet falhou ({e}), tentando Haar Cascade', file=sys.stderr)
        return []


def _detect_haar(frame_files, args, cv2):
    """Fallback: Haar Cascade frontal (built-in OpenCV, sem modelo externo)."""
    try:
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        cascade = cv2.CascadeClassifier(cascade_path)

        results = []
        for idx, fpath in enumerate(frame_files):
            t = idx / args.fps
            img = cv2.imread(fpath)
            if img is None:
                continue
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            h, w = gray.shape[:2]

            faces = cascade.detectMultiScale(
                gray,
                scaleFactor=1.10,
                minNeighbors=5,
                minSize=(max(30, w // 20), max(30, h // 20)),
            )

            if not isinstance(faces, type(None)) and len(faces) > 0:
                # Maior face detectada (provavelmente a principal)
                fx, fy, fw2, fh2 = max(faces, key=lambda f: f[2] * f[3])
                scale_x = args.video_w / w
                scale_y = args.video_h / h
                results.append({
                    't':    round(t, 3),
                    'cx':   round((fx + fw2 / 2) * scale_x / args.video_w, 4),
                    'cy':   round((fy + fh2 / 2) * scale_y / args.video_h, 4),
                    'fw':   round(fw2 * scale_x / args.video_w, 4),
                    'fh':   round(fh2 * scale_y / args.video_h, 4),
                    'conf': 0.65,
                })

        return results

    except Exception as e:
        print(f'Haar Cascade falhou: {e}', file=sys.stderr)
        return []


def _write(path, data):
    try:
        with open(path, 'w') as f:
            json.dump(data, f)
    except Exception as e:
        print(f'Falha ao escrever {path}: {e}', file=sys.stderr)


if __name__ == '__main__':
    main()
