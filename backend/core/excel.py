from io import BytesIO
from typing import Iterable

from openpyxl import Workbook


def build_workbook_bytes(
    sheets: list[tuple[str, list[str], Iterable[Iterable[object]]]],
) -> bytes:
    workbook = Workbook()
    default_sheet = workbook.active
    workbook.remove(default_sheet)

    for title, headers, rows in sheets:
        sheet = workbook.create_sheet(title=title[:31] or "Sheet1")
        sheet.append(headers)
        for row in rows:
            sheet.append(list(row))

    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
