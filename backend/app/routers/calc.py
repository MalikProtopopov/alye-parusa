"""Калькулятор рассрочки (X1). Формула — наша дефолтная (З4), параметры
редактируются в админке; числа — «предварительный расчёт, не оферта» (ст. 437 ГК РФ).
Все проценты — доли 0..1 (0.30 = 30 %)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AppSettings, CalculatorParams, Floorplan
from ..schemas import (
    CalcRequest, CalcResult, CalculatorParamsOut, CalculatorParamsUpdate,
)
from ..security import require_role

router = APIRouter(prefix="/api/v1", tags=["calculator"])
admin_only = require_role("admin")

DEFAULT_DISCLAIMER = (
    "Расчёт рассрочки носит предварительный характер и не является публичной "
    "офертой (ст. 437 ГК РФ). Итоговые условия определяются договором."
)


def _params(db: Session) -> CalculatorParams:
    return db.get(CalculatorParams, 1) or CalculatorParams(
        id=1, min_down_payment_pct=0.30, max_down_payment_pct=0.90,
        term_min_months=6, term_max_months=36, term_step_months=6,
        markup_pct_annual=0.0, disclaimer=DEFAULT_DISCLAIMER,
    )


@router.get("/calculator", response_model=CalculatorParamsOut)
def get_calculator(db: Session = Depends(get_db)):
    return _params(db)


@router.post("/calc", response_model=CalcResult)
def calc(payload: CalcRequest, db: Session = Depends(get_db)):
    p = _params(db)

    # Стоимость лота
    if payload.mode == "floorplan":
        if not payload.floorplan_id:
            raise HTTPException(422, "floorplan_id_required")
        fp = db.get(Floorplan, payload.floorplan_id)
        if fp is None:
            raise HTTPException(404, "floorplan_not_found")
        # З6: при скрытых ценах рассрочка не должна раскрывать стоимость лота
        s = db.get(AppSettings, 1)
        if s is not None and not s.show_prices:
            raise HTTPException(422, "prices_hidden")
        if fp.price is not None:
            price = float(fp.price)
        elif p.price_per_m2 is not None:
            price = float(p.price_per_m2) * float(fp.area_m2)
        else:
            raise HTTPException(422, "price_unavailable")
    else:
        if not payload.amount or payload.amount <= 0:
            raise HTTPException(422, "amount_required")
        price = float(payload.amount)

    # Первоначальный взнос (доля)
    pct = (
        payload.down_payment_pct
        if payload.down_payment_pct is not None
        else float(p.min_down_payment_pct)
    )
    if pct < float(p.min_down_payment_pct) or pct > float(p.max_down_payment_pct):
        raise HTTPException(422, "down_payment_out_of_range")

    # Срок (шаг term_step_months — рекомендация для UI, сервером не проверяется)
    months = payload.months if payload.months is not None else int(p.term_max_months)
    if months < int(p.term_min_months) or months > int(p.term_max_months):
        raise HTTPException(422, "months_out_of_range")

    markup_pct = float(p.markup_pct_annual)
    down_payment = round(price * pct, 2)
    financed = round(price - down_payment, 2)
    markup = round(financed * markup_pct * months / 12.0, 2)
    monthly_payment = round((financed + markup) / months, 2)
    total_cost = round(price + markup, 2)

    return CalcResult(
        price=round(price, 2),
        down_payment_pct=pct,
        down_payment=down_payment,
        financed=financed,
        months=months,
        markup_pct_annual=markup_pct,
        markup=markup,
        monthly_payment=monthly_payment,
        total_cost=total_cost,
        disclaimer=p.disclaimer or DEFAULT_DISCLAIMER,
    )


@router.get("/admin/calculator", response_model=CalculatorParamsOut)
def admin_get_calculator(db: Session = Depends(get_db), _=Depends(admin_only)):
    return _params(db)


@router.put("/admin/calculator", response_model=CalculatorParamsOut)
def admin_put_calculator(payload: CalculatorParamsUpdate, db: Session = Depends(get_db), _=Depends(admin_only)):
    p = db.get(CalculatorParams, 1)
    if p is None:
        p = CalculatorParams(id=1)
        db.add(p)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p
