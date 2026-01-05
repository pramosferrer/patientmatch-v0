import os
import duckdb


DB_PATH = os.getenv("DUCKDB_PATH", "../db/aact.duckdb")


def get_dtype(con, schema, table, column):
    q = """
    select data_type
    from information_schema.columns
    where table_schema = ? and table_name = ? and column_name = ?
    """
    rows = con.execute(q, [schema, table, column]).fetchall()
    return rows[0][0] if rows else None


def get_samples(con, schema, table, column, limit=5):
    q = f"select {column} from {schema}.{table} where {column} is not null limit {int(limit)}"
    rows = con.execute(q).fetchall()
    return [r[0] for r in rows]


def main():
    con = duckdb.connect(DB_PATH)

    counts = [
        ("gold.pm_trials_serving", "select count(*) from gold.pm_trials_serving"),
        ("gold.pm_questionnaires", "select count(*) from gold.pm_questionnaires"),
        (
            "join pm_trials_serving x pm_questionnaires",
            "select count(*) from gold.pm_trials_serving t "
            "join gold.pm_questionnaires q on q.nct_id = t.nct_id",
        ),
    ]

    print(f"DB_PATH: {DB_PATH}")
    for label, q in counts:
        count = con.execute(q).fetchone()[0]
        print(f"{label} count: {count}")

    columns = [
        ("gold", "pm_trials_serving", "states_list"),
        ("gold", "pm_questionnaires", "readiness"),
        ("gold", "pm_questionnaires", "quality_score"),
    ]

    print("")
    for schema, table, column in columns:
        dtype = get_dtype(con, schema, table, column)
        samples = get_samples(con, schema, table, column, limit=5)
        print(f"{schema}.{table}.{column} type: {dtype}")
        print(f"{schema}.{table}.{column} samples: {samples}")


if __name__ == "__main__":
    main()
