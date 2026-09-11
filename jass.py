from pathlib import Path
from bs4 import BeautifulSoup
import json
import re
from functools import cached_property
import numpy as np

def read_file(path):
    with open(path, "r", encoding="utf-8-sig") as f:
        return f.read().splitlines()

def read_xml(path):
    with open(path, "r") as f:
        text = f.read()
    return BeautifulSoup(text, "xml")

def write_file(list_2d):
    with open("output.txt", "w", encoding="utf-8-sig") as f:
        f.write("\n".join(["\n".join(l) for l in list_2d]))

class JassKeywords:

    _path = Path(r".\data\Jass_and_vJass-Luashine-v8.xml")
    _jass_version = "Jass (Luashine) v8"

    def _get_keywords(self, soup, name):
        text = soup.find(attrs={"name":name}).contents[0]
        for line in text.splitlines():
            for t in line.split(" "):
                yield t.strip()

    def _get_all_keywords(self, soup):
        names = ("Keywords1", "Keywords2", "Keywords3", 
                 "Keywords4", "Keywords5", "Keywords6",
                 "Keywords7", "Keywords8")
        for name in names:
            yield from self._get_keywords(soup, name)

    @cached_property
    def _soup(self):
        return read_xml(self._path).find(attrs={"name":self._jass_version})

    @cached_property
    def keywords(self):
        return list(self._get_all_keywords(self._soup))

    @cached_property
    def open(self):
        attrs = {"name":"Folders in code2, open"}
        return self._soup.find(attrs=attrs).contents[0].split(" ")

    @cached_property
    def close(self):
        attrs = {"name":"Folders in code2, close"}
        return self._soup.find(attrs=attrs).contents[0].split(" ")

    @cached_property
    def all_keywords(self):
        return self.keywords + self.open + self.close + ["array"]

    @cached_property
    def operators(self):
        return ["+", "-", "*", "/", "(", ")", "[", "]", "<", "=", ">", ",", ".", ":"]

jass_keywords = JassKeywords()

class Converter:

    _separator = "(\\+|-|\\*|/|\\(|\\)|\\[|\\]|<|=|>|,|:| )"
    _str_pattern = "(\".*?\")"

    def _is_str(self, text):
        return re.match(self._str_pattern, text) is not None

    def _is_number(self, text):
        try:
            float(text)
            return True
        except ValueError:
            return False

    def _is_address(self, text):
        return re.match(r"\$[0-9a-fA-F]+", text) is not None

    def _is_operator(self, text):
        return text in jass_keywords.operators

    def _split_line(self, line):
        exclude = (None, "", " ")
        pattern = "(\".*?\")"

        def split_line(line):
            for t in re.split(self._separator, line):
                if t not in exclude:
                    yield t

        lines = re.split(self._str_pattern, line)
        for t in lines:
            if self._is_str(t):
                yield t
            else:                
                yield from split_line(t)

    def _convert_line(self, line):
        for text in self._split_line(line):
            if text in jass_keywords.all_keywords \
                or self._is_str(text) \
                or self._is_address(text) \
                or self._is_operator(text) \
                or self._is_number(text):
                yield text
            else:
                yield "Var"

    def convert_line(self, line):
        return list(self._convert_line(line))

converter = Converter()

class Jass:
    
    def __init__(self, lines, name="root"):
        self.lines = lines
        self.name = name

    def _splitlines(self, start_text, end_text):
        pattern = rf"({start_text}[\s\S]*?{end_text})"
        text = "\n".join(self.lines)
        for match in re.finditer(pattern, text):
            lines = match.group(0).splitlines()
            if start_text == "function":
                name = lines[0].split(" ")[1]
                yield lines, name
            else:
                yield lines, start_text

    def _get_globals(self):
        return self._splitlines("globals", "endglobals")

    def _get_if(self):
        return self._splitlines("if", "endif")

    def _get_loop(self):
        return self._splitlines("loop", "endloop")

    def _get_functions(self):
        return self._splitlines("function", "endfunction")

    @cached_property
    def globals(self):
        return [Jass(lines, name) for lines, name in self._get_globals()]

    @cached_property
    def ifs(self):
        return [Jass(lines, name) for lines, name in self._get_if()]

    @cached_property
    def loops(self):
        return [Jass(lines, name) for lines, name in self._get_loop()]

    @cached_property
    def functions(self):
        return [Jass(lines, name) for lines, name in self._get_functions()]

    def get_function_by_name(self, name):
        for function in self.functions:
            if function.name == name:
                return function
        return None

    def to_converted_lines(self):
        return [converter.convert_line(line) for line in self.lines]

    def to_string(self):
        return "\n".join(" ".join(line) for line in self.to_converted_lines())

    def __eq__(self, other):
        if not isinstance(other, Jass):
            return NotImplemented

        return self.to_converted_lines() == other.to_converted_lines()

    def __repr__(self):
        return self.to_string()


def similarity_2d(array1, array2):
    """Return positional similarity between two 2D arrays, from 0.0 to 1.0."""
    rows1 = list(array1)
    rows2 = list(array2)
    if not rows1 and not rows2:
        return 1.0

    row_count = max(len(rows1), len(rows2))
    column_count = max(
        [len(row) for row in rows1] + [len(row) for row in rows2],
        default=0,
    )
    total = row_count * column_count
    if total == 0:
        return 1.0

    matched = 0
    for row_index in range(row_count):
        for column_index in range(column_count):
            if row_index >= len(rows1):
                continue
            if row_index >= len(rows2):
                continue
            if column_index >= len(rows1[row_index]):
                continue
            if column_index >= len(rows2[row_index]):
                continue
            if rows1[row_index][column_index] == rows2[row_index][column_index]:
                matched += 1

    return matched / total

def compare_jass(jass1, jass2):
    func1 = jass1.functions
    func2 = jass2.functions

    lines1 = [f.lines for f in func1]
    lines2 = [f.lines for f in func2]
    lines = lines2.copy()

    num = []
    for i, l2 in enumerate(lines2):
        if l2 not in lines1:
            num.append(i)
            print(f"Function {i} not found in jass1")
            continue

    return num

def find_func_name(name, j1, j2, c2):
    for i, f in enumerate(j1.functions):
        if name == f.name:
            break
    func = c2.functions[i]    

    index = []
    for i, f in enumerate(c2.functions):
        if func.lines == f.lines:
            index.append(i)

    names = []
    for i in index:
        name = j2.functions[i].name
        print(f"Adding function {name} at index {i}")
        names.append(name)

    return names    

if __name__ == "__main__":
    old_path = Path(r".\data\twrpg0.92_original.j")
    new_path = Path(r".\data\twrpg0.94_original.j")

    j1 = Jass(read_file(old_path))
    j2 = Jass(read_file(new_path))

    c1 = Jass(read_file("convert_lines1.txt"))
    c2 = Jass(read_file("convert_lines2.txt"))

    find_func_name("Oq60", j1, j2, c2)