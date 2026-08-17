# frozen_string_literal: true

module Reports
  module PdfTypography
    FONT_FAMILY = "CornerstoneSans"
    FONT_DIRECTORY = Rails.root.join("app/assets/fonts/inter")
    CJK_FALLBACK_FAMILY = "CornerstoneCJK"
    CJK_FONT_PATH = Rails.root.join("app/assets/fonts/noto_sans_sc/regular.ttf")

    module_function

    def apply(pdf)
      pdf.font_families.update(
        FONT_FAMILY => {
          normal: FONT_DIRECTORY.join("regular.ttf").to_s,
          bold: FONT_DIRECTORY.join("bold.ttf").to_s
        },
        CJK_FALLBACK_FAMILY => {
          normal: CJK_FONT_PATH.to_s,
          bold: CJK_FONT_PATH.to_s
        }
      )
      pdf.fallback_fonts = [ CJK_FALLBACK_FAMILY ]
      pdf.font FONT_FAMILY
    end
  end
end
