# The QR code on the booth screen and signs: opens nohm.app/try.
#   pip install qrcode && python3 tools/booth/make_qr.py
import qrcode
import qrcode.image.svg

URL = "https://nohm.app/try"
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=2)
qr.add_data(URL)
qr.make(fit=True)
qr.make_image(image_factory=qrcode.image.svg.SvgPathImage).save("public/booth/qr-try.svg")
# Scale to whatever box the page gives it.
svg = open("public/booth/qr-try.svg").read()
svg = svg.replace('width="29mm" height="29mm" ', '', 1)
open("public/booth/qr-try.svg", "w").write(svg)
# Print size: 2400px square, sharp at 8 inches.
big = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=4, box_size=64)
big.add_data(URL)
big.make(fit=True)
big.make_image(fill_color="#171a20", back_color="white").save("public/booth/qr-try-print.png")
print("wrote public/booth/qr-try.svg and qr-try-print.png")
