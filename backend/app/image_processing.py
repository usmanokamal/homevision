import base64
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont, ImageOps


def build_edit_prompt(target: str, desired_change: str) -> str:
    normalized_target = target.strip().lower()
    normalized_change = desired_change.strip()

    return (
        "Edit this interior design photo. "
        f"Change only the {normalized_target} to {normalized_change}. "
        "Preserve the room layout, perspective, lighting, shadows, furniture placement, "
        "decor, wall openings, proportions, and all other surfaces exactly as they are. "
        "Keep the result photorealistic, seamless, and suitable for a real renovation preview."
    )


def to_data_url(image_bytes: bytes, content_type: str) -> str:
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{content_type};base64,{encoded}"


def apply_guest_free_tier_policy(image_bytes: bytes) -> tuple[bytes, str]:
    image = Image.open(BytesIO(image_bytes))
    image = ImageOps.exif_transpose(image).convert("RGBA")

    max_width = 1280
    if image.width > max_width:
        ratio = max_width / image.width
        image = image.resize(
            (max_width, int(image.height * ratio)),
            Image.Resampling.LANCZOS,
        )

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = ImageFont.load_default()

    banner_height = max(68, image.height // 10)
    banner_top = image.height - banner_height - 24
    draw.rounded_rectangle(
        [(24, banner_top), (image.width - 24, image.height - 24)],
        radius=20,
        fill=(24, 18, 12, 168),
    )
    message = "FREE PREVIEW  |  SIGN UP TO REMOVE WATERMARK AND EXPORT HD"
    text_bbox = draw.textbbox((0, 0), message, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    text_x = max(36, (image.width - text_width) // 2)
    text_y = banner_top + ((banner_height - text_height) // 2)
    draw.text((text_x, text_y), message, fill=(255, 244, 231, 255), font=font)

    for offset in range(-image.height, image.width, 260):
        draw.text(
            (offset, image.height // 3),
            "HOMEVISION FREE PREVIEW",
            fill=(255, 255, 255, 44),
            font=font,
        )

    composited = Image.alpha_composite(image, overlay).convert("RGB")
    output = BytesIO()
    composited.save(output, format="JPEG", quality=55, optimize=True)
    return output.getvalue(), "image/jpeg"
