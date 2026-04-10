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


POS_MAP = {
    # 日文词性 → 中文
    '名詞': '名词', 'めいし': '名词',
    '動詞': '动词', 'どうし': '动词',
    '形容詞': '形容词', 'けいようし': '形容词',
    '形容動詞': '形容词', 'けいようどうし': '形容词',
    'い形容詞': '形容词', 'な形容詞': '形容词',
    'イ形容詞': '形容词', 'ナ形容詞': '形容词',
    '副詞': '副词', 'ふくし': '副词',
    '助詞': '助词', 'じょし': '助词',
    '接続詞': '连词', 'せつぞくし': '连词',
    '感動詞': '感叹词', 'かんどうし': '感叹词', '感嘆詞': '感叹词',
    '代名詞': '代词', 'だいめいし': '代词',
    '数詞': '数词', 'すうし': '数词',
    '接尾詞': '接尾词', '接尾辞': '接尾词',
    '接頭詞': '接头词', '接頭辞': '接头词',
    '連体詞': '其他', '助動詞': '其他',
    # 英文词性 → 中文
    'noun': '名词', 'n': '名词', 'n.': '名词',
    'verb': '动词', 'v': '动词', 'v.': '动词', 'vt': '动词', 'vi': '动词',
    'vt.': '动词', 'vi.': '动词',
    'adjective': '形容词', 'adj': '形容词', 'adj.': '形容词', 'a.': '形容词',
    'adverb': '副词', 'adv': '副词', 'adv.': '副词',
    'pronoun': '代词', 'pron': '代词', 'pron.': '代词',
    'preposition': '介词', 'prep': '介词', 'prep.': '介词',
    'conjunction': '连词', 'conj': '连词', 'conj.': '连词',
    'interjection': '感叹词', 'interj': '感叹词', 'interj.': '感叹词',
    'article': '冠词', 'art': '冠词', 'art.': '冠词',
    'numeral': '数词', 'num': '数词', 'num.': '数词',
    'determiner': '冠词', 'det': '冠词',
    # 中文变体
    '名': '名词', '动': '动词', '形': '形容词', '副': '副词',
    '其它': '其他',
}

VALID_POS = {'名词', '动词', '形容词', '副词', '助词', '连词', '感叹词', '代词', '数词', '接尾词', '接头词', '介词', '冠词', '其他'}

def normalize_pos(raw_pos):
    """将各种格式的词性统一映射到系统白名单"""
    if not raw_pos:
        return '名词'
    cleaned = raw_pos.strip().lower()
    # 先精确匹配
    if cleaned in POS_MAP:
        return POS_MAP[cleaned]
    # 原文匹配（日文不区分大小写无意义，但中文可能直接命中）
    if raw_pos.strip() in POS_MAP:
        return POS_MAP[raw_pos.strip()]
    if raw_pos.strip() in VALID_POS:
        return raw_pos.strip()
    # 子串匹配
    for key, val in POS_MAP.items():
        if key in cleaned:
            return val
    return '名词'


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
                
                # 3. 词性：使用智能映射
                raw_pos = extract_basic_text(fields[3]) if len(fields) > 3 else ""
                if not raw_pos and extracted_tags:
                    raw_pos = extracted_tags[0]
                pos = normalize_pos(raw_pos)
                
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
