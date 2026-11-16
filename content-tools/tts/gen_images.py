"""Sinh tranh minh hoạ trên máy bằng Z-Image-Turbo (Apache-2.0).

  macOS (Apple Silicon): mflux (MLX), bản 4-bit filipstrand/Z-Image-Turbo-mflux-4bit
  Windows/Linux:         diffusers + PyTorch CUDA (cần GPU NVIDIA, nên ≥ 12 GB VRAM), Tongyi-MAI/Z-Image-Turbo

Đầu vào (JSON qua stdin): {"width": 1344, "height": 768, "steps": 9,
                           "jobs": [{"scene": 3, "prompt": "...", "seed": 1003, "out": "/abs/scene03.jpg"}]}
Nạp mô hình một lần rồi sinh lần lượt; in "DONE <scene> <out>" sau mỗi ảnh. Ảnh lưu PNG (Node chuyển sang JPEG).
"""
import json
import os
import sys


def mlx_generator(job):
    from mflux.models.common.config import ModelConfig
    from mflux.models.z_image import ZImage

    model = ZImage(model_config=ModelConfig.z_image_turbo(), model_path=job.get("model") or "filipstrand/Z-Image-Turbo-mflux-4bit")

    def gen(j):
        return model.generate_image(seed=j["seed"], prompt=j["prompt"], num_inference_steps=job["steps"],
                                    width=job["width"], height=job["height"])
    return gen


def torch_generator(job):
    import torch
    from diffusers import ZImagePipeline

    if not torch.cuda.is_available():
        sys.exit("Không có GPU NVIDIA (CUDA) — sinh ảnh AI trên CPU quá chậm, bỏ qua.")
    pipe = ZImagePipeline.from_pretrained(job.get("model") or "Tongyi-MAI/Z-Image-Turbo", torch_dtype=torch.bfloat16)
    if torch.cuda.get_device_properties(0).total_memory < 20 * 1024 ** 3:
        pipe.enable_model_cpu_offload()  # GPU 12–16 GB: chuyển dần từng phần lên GPU
    else:
        pipe.to("cuda")

    def gen(j):
        g = torch.Generator("cuda").manual_seed(j["seed"])
        return pipe(prompt=j["prompt"], num_inference_steps=job["steps"], guidance_scale=0.0,
                    width=job["width"], height=job["height"], generator=g).images[0]
    return gen


def main():
    job = json.load(sys.stdin)
    job.setdefault("steps", 9)
    job.setdefault("width", 1344)
    job.setdefault("height", 768)
    gen = mlx_generator(job) if sys.platform == "darwin" else torch_generator(job)
    for j in job["jobs"]:
        image = gen(j)
        tmp = j["out"] + ".png"
        image.save(tmp)
        os.replace(tmp, j["out"])
        print(f"DONE {j['scene']} {j['out']}", flush=True)


if __name__ == "__main__":
    main()
