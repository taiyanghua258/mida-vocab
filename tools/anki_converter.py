import sqlite3
import zipfile
import json
import os
import re
import argparse
import tempfile
import html

def extract_basic_text(text):
    """基础清洗：用于清理本体和读音"""
    if not text: return ""
    text = re.sub(r'\[sound:[^\]]+\]', '', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = html.unescape(text)
    return text.strip()

def extract_core_meaning_and_tags(text):
    """智能清洗：模拟 AI 提取核心释义与标签"""
    if not text: return "", []
    
    # 1. 剔除发音音频
    text = re.sub(r'\[sound:[^\]]+\]', '', text)
    
    # 2. 将 HTML 换行与区块标签转为真实的换行符（关键：保留原文的段落结构）
    text = re.sub(r'(?i)<br\s*/?>|</div>|</p>|</li>|</tr>', '\n', text)
    
    # 3. 剥离残余的 HTML 标签和转义符
    text = re.sub(r'<[^>]+>', '', text)
    text = html.unescape(text)
    
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    if not lines: return "", []

    core_meaning = ""
    tags = []

    for line in lines:
        # 捕捉特征标签：例如 【名词】、[自他动词]、<N5> 等
        tag_matches = re.findall(r'【(.*?)】|\[(.*?)\]|<(.*?)>', line)
        for match_tuple in tag_matches:
            tags.extend([item for item in match_tuple if item])

        # 去除刚才匹配到的括号，提纯文本
        clean_line = re.sub(r'【.*?】|\[.*?\]|<.*?>', '', line).strip()
        
        # 很多牌组会在括号里放一大串日文解释，直接剥离这部分补充说明
        clean_line = re.sub(r'（.*?）|\(.*?\)', '', clean_line).strip()

        # 找到第一行有实际中文释义的内容，截胡作为“核心释义”
        if clean_line and not core_meaning:
            # 清理开头的排版序号，例如 "1.", "①", "-", "a."
            clean_line = re.sub(r'^([\d①-⑳]+[\.\、\)]?|[\-•\*])\s*', '', clean_line)
            core_meaning = clean_line
            
            # 【核心逻辑】：一旦抓到核心释义，直接中断！抛弃下方庞大的例句块
            break

    # 兜底方案：如果全被过滤完了，拿第一行强制截取前 30 字
    if not core_meaning and lines:
        core_meaning = lines[0][:30]

    # 取字数较短的最重要的前两个标签
    valid_tags = [t for t in tags if len(t) < 10][:2]

    return core_meaning[:50], valid_tags # 强制最高 50 字，保证卡片绝对清爽


def process_apkg(input_file, output_file):
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            with zipfile.ZipFile(input_file, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
        except zipfile.BadZipFile:
            print("Error: 无效的 .apkg 压缩包格式")
            return
        
        db_path = os.path.join(temp_dir, "collection.anki21")
        if not os.path.exists(db_path):
            db_path = os.path.join(temp_dir, "collection.anki2")
            
        if not os.path.exists(db_path):
            print("Error: 未找到 collection.anki2 数据库")
            return
            
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT flds FROM notes")
            rows = cursor.fetchall()
        except sqlite3.Error as e:
            print(f"Error: 数据库读取失败 - {e}")
            conn.close()
            return
        
        words_list = []
        for row in rows:
            fields = row[0].split('\x1f')
            
            if len(fields) >= 2:
                # 1. 提取本体和读音
                japanese = extract_basic_text(fields[0])
                reading = extract_basic_text(fields[1]) if len(fields) > 1 else ""
                
                # 2. 模拟 AI 提取核心释义和隐藏在括号里的标签
                raw_meaning = fields[2] if len(fields) > 2 else reading
                meaning, extracted_tags = extract_core_meaning_and_tags(raw_meaning)
                
                # 3. 词性
                pos = extract_basic_text(fields[3]) if len(fields) > 3 else ""
                if not pos and extracted_tags:
                    pos = extracted_tags[0] # 经常有人把词性写在【】里，我们借用给词性字段
                
                # 4. 组装最终标签
                final_tags = ["Anki清洗"]
                if extracted_tags:
                    final_tags.extend(extracted_tags)
                
                # 防止读音 and 释义长得一模一样
                if reading == meaning: reading = ""
                
                if japanese: 
                    words_list.append({
                        "japanese": japanese,
                        "reading": reading,
                        "meaning": meaning if meaning else "暂无释义",
                        "partOfSpeech": pos if pos else "名词",
                        "tags": list(set(final_tags)) # 标签去重
                    })
                
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(words_list, f, ensure_ascii=False, indent=2)
        
        conn.close()
        print(f"转换成功！共智能清洗了 {len(words_list)} 个单词的核心内容。")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Anki .apkg 转 JSON 云端清洗工具 (智能提取版)")
    parser.add_argument("input", help="输入的 .apkg 文件路径")
    parser.add_argument("--output", default="converted_vocab.json", help="输出的 JSON 文件路径")
    args = parser.parse_args()
    
    process_apkg(args.input, args.output)
