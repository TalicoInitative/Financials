import json
# INDEPENDENT implementation written from the build prompt's §8 and §22 definitions.
COUNTED = {"received", "paid", "partially_received"}
KIND = {"business_income":"income","employment_income":"income","gift":"income","refund":"income",
        "reimbursement":"income","business_expense":"expense","personal_expense":"expense",
        "tax_payment":"expense","loan_proceeds":"loan_in","loan_repayment":"loan_out",
        "transfer":"transfer","opening_balance":"adjust","adjustment":"adjust",
        "planned_income":"planned","planned_expense":"planned"}
EARNED = {"business_income","employment_income"}

def counted(t):
    return t["status"] in COUNTED and KIND[t["type"]] != "planned"

def net_impact(t):
    k = KIND[t["type"]]
    conv, fees, rel, tax = t["conv"], t["fees"], t["rel"], t["tax"]
    if k == "income":                       # §8: converted minus fees and direct expenses
        return conv - fees - rel - tax
    if k == "expense":                      # §8: negative converted amount
        return -conv
    if k == "transfer":                     # §8: zero effect on total net worth
        return 0
    if k == "loan_in":                      # positive cash, not income
        return conv
    if k == "loan_out":
        return -conv
    if k == "adjust":                       # signed amount
        return conv
    return 0

def in_through(t, through):
    if t["dp"] == "day" and t["date"]:
        return t["date"] <= through
    ym = t["rm"]                            # month-only: counts within its month
    return ym <= through[:7]

def balance(txs, through):
    return sum(net_impact(t) for t in txs if counted(t) and in_through(t, through))

def in_window(t, a, b):
    if t["dp"] == "day" and t["date"]:
        return a <= t["date"] <= b
    return a[:7] <= t["rm"] <= b[:7]

def totals(txs, a, b):
    sel = [t for t in txs if counted(t) and in_window(t, a, b)]
    gross = sum(t["conv"] for t in sel if t["type"] in EARNED)          # §22: BEFORE fees
    fees  = sum(t["fees"] + t["rel"] + t["tax"] for t in sel if t["type"] in EARNED)
    bizexp = sum(t["conv"] for t in sel if t["type"] == "business_expense")
    netbiz = gross - fees - bizexp          # tax payments are their own bucket (see calc guide)
    bizexp_all = bizexp + fees              # what the app labels "business expenses & fees"
    cash = sum(net_impact(t) for t in sel)
    return gross, bizexp_all, netbiz, cash

def month(txs, ym):
    sel = [t for t in txs if counted(t) and t["rm"] == ym]
    g = sum(t["conv"] for t in sel if t["type"] in EARNED)
    e = sum(t["conv"] for t in sel if t["type"] == "business_expense")
    f = sum(t["fees"] + t["rel"] + t["tax"] for t in sel if t["type"] in EARNED)
    return g, e + f

cases = json.load(open("diffcases.json"))
mismatch = {}
for i, c in enumerate(cases):
    txs = c["txs"]
    checks = [
        ("balance",  balance(txs, "2026-08-31"),                 c["appBalance"]),
        ("gross",    totals(txs, "2026-06-01", "2026-08-31")[0], c["appGross"]),
        ("bizexp",   totals(txs, "2026-06-01", "2026-08-31")[1], c["appBizExp"]),
        ("netbiz",   totals(txs, "2026-06-01", "2026-08-31")[2], c["appNetBiz"]),
        ("cash",     totals(txs, "2026-06-01", "2026-08-31")[3], c["appCash"]),
        ("julgross", month(txs, "2026-07")[0],                   c["appJul"]),
        ("julexp",   month(txs, "2026-07")[1],                   c["appJulExp"]),
    ]
    for name, mine, theirs in checks:
        if mine != theirs:
            mismatch.setdefault(name, []).append((i, mine, theirs))

print(f"cross-checked {len(cases)} randomized ledgers against an independent implementation\n")
if not mismatch:
    print("  ALL METRICS AGREE on every case")
else:
    for name, rows in mismatch.items():
        print(f"  DISAGREEMENT in '{name}': {len(rows)}/{len(cases)} cases")
        for i, mine, theirs in rows[:3]:
            print(f"     case {i}: oracle={mine}  app={theirs}  (diff {theirs-mine})")
