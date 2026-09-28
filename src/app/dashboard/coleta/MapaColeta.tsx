"use client";

import { useEffect, useMemo, Fragment } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { ColetaFila, EntregadorMapa, PontoMapa } from "@/lib/coleta-types";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [-22.72, -47.64];

const MOTO_SRC: Record<string, string> = {
  disponivel: "/coleta/moto-disponivel.png",
  ocupado: "/coleta/moto-ocupado.png",
  offline: "/coleta/moto-offline.png",
};

function makeDivIcon(opts: {
  color: string;
  label: string;
  dashed?: boolean;
  size?: number;
}) {
  const size = opts.size ?? 28;
  const border = opts.dashed ? "2px dashed #fff" : "2px solid #fff";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${opts.color};border:${border};box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:700 11px/1 system-ui,sans-serif;">${opts.label}</div>`,
  });
}

function makeEntregadorIcon(status: string, posicaoIncerta: boolean) {
  const src = MOTO_SRC[status] ?? MOTO_SRC.offline;
  const size = 36;
  const outline = posicaoIncerta
    ? "outline:2px dashed #b45309;outline-offset:2px;border-radius:6px;"
    : "";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<img src="${src}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4));${outline}" />`,
  });
}

function FitBoundsOnce({
  positions,
  enabled,
}: {
  positions: [number, number][];
  enabled: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || positions.length === 0) return;
    const bounds = L.latLngBounds(positions.map(([lat, lng]) => [lat, lng]));
    map.fitBounds(bounds.pad(0.15));
  }, [enabled, map, positions]);
  return null;
}

function FocusTarget({
  target,
}: {
  target: { lat: number; lng: number; zoom?: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.setView([target.lat, target.lng], target.zoom ?? 16, { animate: true });
  }, [map, target]);
  return null;
}

export default function MapaColeta({
  entregadores,
  pontos,
  coletas,
  focus,
  fitOnce,
  onFitted,
}: {
  entregadores: EntregadorMapa[];
  pontos: PontoMapa[];
  coletas: ColetaFila[];
  focus: { lat: number; lng: number; zoom?: number } | null;
  fitOnce: boolean;
  onFitted: () => void;
}) {
  const positions = useMemo(() => {
    const list: [number, number][] = [];
    for (const p of pontos) {
      if (Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) {
        list.push([p.latitude, p.longitude]);
      }
    }
    for (const e of entregadores) {
      if (
        e.latitude != null &&
        e.longitude != null &&
        Number.isFinite(e.latitude) &&
        Number.isFinite(e.longitude)
      ) {
        list.push([e.latitude, e.longitude]);
      }
    }
    return list;
  }, [entregadores, pontos]);

  useEffect(() => {
    if (fitOnce && positions.length > 0) onFitted();
  }, [fitOnce, onFitted, positions.length]);

  const coletasPorEndereco = useMemo(() => {
    const map = new Map<string, ColetaFila[]>();
    for (const c of coletas) {
      if (!c.endereco_id) continue;
      const arr = map.get(c.endereco_id) ?? [];
      arr.push(c);
      map.set(c.endereco_id, arr);
    }
    return map;
  }, [coletas]);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={13}
      className="h-full w-full rounded-xl z-0"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBoundsOnce positions={positions} enabled={fitOnce && positions.length > 0} />
      <FocusTarget target={focus} />

      {pontos.map((p) => {
        const isLab = p.tipo === "laboratorio";
        const opacity = p.aceita_coleta === false ? 0.45 : 1;
        const color = isLab ? "#023366" : "#0B64C0";
        const icon = makeDivIcon({
          color,
          label: isLab ? "L" : "C",
          size: isLab ? 34 : 26,
        });
        const openColetas = coletasPorEndereco.get(p.id) ?? [];
        const geoWarn =
          p.geo_status && p.geo_status !== "ok" && p.geo_status !== "manual";

        return (
          <Fragment key={`${p.tipo}-${p.id}`}>
            <Marker
              position={[p.latitude, p.longitude]}
              icon={icon}
              opacity={opacity}
            >
              <Popup>
                <div className="text-sm min-w-[12rem]">
                  <div className="font-bold">{p.nome}</div>
                  {p.unidade ? (
                    <div className="text-slate-600">{p.unidade}</div>
                  ) : null}
                  {p.endereco_resumo ? (
                    <div className="text-slate-600 mt-1">{p.endereco_resumo}</div>
                  ) : null}
                  {geoWarn ? (
                    <div className="text-amber-700 mt-1">
                      Coordenada a revisar ({p.geo_status}
                      {p.geo_precisao ? ` / ${p.geo_precisao}` : ""})
                    </div>
                  ) : null}
                  {p.aceita_coleta === false ? (
                    <div className="text-slate-500 mt-1">Não aceita coleta</div>
                  ) : null}
                  {openColetas.length > 0 ? (
                    <div className="mt-2 border-t pt-1">
                      <div className="font-semibold text-xs uppercase text-slate-500">
                        Coletas abertas
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {openColetas.map((c) => (
                          <li key={c.id}>
                            {c.protocolo ?? c.id.slice(0, 8)} — {c.status}
                            {c.sla_estourado ? " · SLA" : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </Popup>
            </Marker>
            {p.raio_geofence_m != null && p.raio_geofence_m > 0 ? (
              <Circle
                center={[p.latitude, p.longitude]}
                radius={p.raio_geofence_m}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.08,
                  weight: 1,
                  opacity: 0.5,
                }}
              />
            ) : null}
          </Fragment>
        );
      })}

      {entregadores.map((e) => {
        if (e.latitude == null || e.longitude == null) return null;
        if (!Number.isFinite(e.latitude) || !Number.isFinite(e.longitude)) {
          return null;
        }
        const icon = makeEntregadorIcon(e.status, e.posicao_incerta);
        const minAtras =
          e.segundos_desde_posicao != null
            ? Math.max(0, Math.floor(e.segundos_desde_posicao / 60))
            : null;

        return (
          <Marker
            key={e.id}
            position={[e.latitude, e.longitude]}
            icon={icon}
          >
            <Popup>
              <div className="text-sm min-w-[11rem]">
                <div className="font-bold">{e.nome}</div>
                <div className="capitalize text-slate-600">{e.status}</div>
                <div className="mt-1">
                  Carga: {e.coletas_ativas}/{e.capacidade_max}
                  {e.sem_vaga ? " (lotado)" : ""}
                </div>
                {e.posicao_incerta ? (
                  <div className="text-amber-700 mt-1">
                    Posição de {minAtras ?? "?"} min atrás
                  </div>
                ) : minAtras != null ? (
                  <div className="text-slate-500 mt-1">
                    Atualizado há {minAtras} min
                  </div>
                ) : null}
                {e.geofence_descricao ? (
                  <div className="mt-1 text-slate-600">
                    Cerca: {e.geofence_descricao}
                    {e.geofence_papel ? ` (${e.geofence_papel})` : ""}
                  </div>
                ) : null}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
