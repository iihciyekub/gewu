import base64
from pathlib import Path

woff_dir = Path("woff-v2")
output_path = Path("mathjax_fonts_base64.css")

rules = []
for file in woff_dir.glob("*.woff"):
    name = file.stem
    encoded = base64.b64encode(file.read_bytes()).decode("utf-8")
    rules.append(f"""
@font-face {{
  font-family: '{name}';
  src: url(data:font/woff;base64,{encoded}) format('woff');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}}""")

output_path.write_text('\n\n'.join(rules))
print("✅ Done!")