# AI Price History

Daily, machine-readable AI model price history published by
[AICostIndex](https://aicostindex.com).

[![License: CC BY 4.0](https://img.shields.io/badge/License-CC_BY_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)

![Example price-history chart](examples/price-history-example.svg)

## Data

The complete dataset is [`data/ai-prices.csv`](data/ai-prices.csv). Each row is
one verified price observation. USD and JPY values are prices per one million
tokens. JPY values include the 10% Japanese consumption-tax treatment used by
AICostIndex at verification time.

The repository contains public data only. Raw captures, internal evidence,
database identifiers, operational metadata, subscriber information, and
credentials are never published here.

### CSV schema

The header is fixed:

```csv
model,date,field,usd,jpy,source
```

| Column | Type | Meaning |
|---|---|---|
| `model` | string | Canonical model display name |
| `date` | `YYYY-MM-DD` | UTC verification date |
| `field` | enum | `input`, `output`, or `cached_input` |
| `usd` | non-negative number | USD per one million tokens |
| `jpy` | non-negative number | JPY per one million tokens, including the AICostIndex tax treatment |
| `source` | public HTTP(S) URL | Public evidence or provenance URL used for the observation |

The machine-readable contract is in [`schema.json`](schema.json).

The initial release contains every distinct historical observation available to
AICostIndex under this six-column public schema. If multiple internal records
resolve to the same `model,date,field,usd,jpy,source` tuple, they are represented
by one CSV row because the public schema intentionally contains no internal
record identifier.

Source precedence is:

1. the public URL stored with the verification evidence;
2. the official vendor pricing page for the verified official/channel lines;
3. the public LiteLLM source snapshot for legacy Line A observations;
4. the relevant AICostIndex model/data page for legacy records that predate an
   external evidence URL.

For current model tables, source notes, and methodology, see the
[AICostIndex model data pages](https://aicostindex.com/en/models) and
[data-source page](https://aicostindex.com/en/data-source).

## Citation

This dataset is licensed under
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
When using the data, include the verification date:

> **AICostIndex, verified YYYY-MM-DD**

Recommended extended citation:

```text
AICostIndex, verified YYYY-MM-DD,
https://github.com/koyamasann/ai-price-history,
licensed under CC BY 4.0.
```

## Chart example

The included example computes the median USD input price for one model on each
date, which avoids treating multiple public sources on the same date as a
single preferred vendor.

```bash
python -m pip install matplotlib
python examples/plot.py "GPT-4o" input
```

Equivalent analysis:

```python
import csv
from collections import defaultdict
from statistics import median

series = defaultdict(list)
with open("data/ai-prices.csv", newline="", encoding="utf-8") as source:
    for row in csv.DictReader(source):
        if row["model"] == "GPT-4o" and row["field"] == "input":
            series[row["date"]].append(float(row["usd"]))

daily_median = [(day, median(values)) for day, values in sorted(series.items())]
```

## Updates and validation

The private `aicost-agent` pipeline appends newly verified public observations
once per day. Cross-repository writes use a dedicated fine-grained GitHub token
restricted to this repository with **Contents: Read and write** only.

Every push validates:

- the exact six-column schema;
- numeric and date types;
- public source URLs;
- duplicate rows;
- state/row-count reconciliation;
- common credential and private-key signatures.

Existing rows are not rewritten by the daily job. Corrections require an
explicit, reviewed data commit.

## License

See [`LICENSE`](LICENSE) for the complete CC BY 4.0 legal code.
