// Everything static about one map in 3D: terrain, walls, decks, liquids, foliage, props and the
// additive light pools under every lamp. Built once per GameMap and cached by the engine.
import * as THREE from 'three';
import type { GameMap } from '../world/tilemap';
import { TILE } from '../data/constants';
import { REALMS } from '../data/realms';
import type { DetailLib } from './textures';
import type { Quality } from './quality';
import type { Environment } from './env';
import { TerrainField, buildDecks, buildGroundGeometry, buildTerrainTextures, buildWalls, makeTerrainMaterial, type TerrainTextures, type TerrainUniforms } from './terrain';
import { Liquid } from './water';
import { Foliage } from './foliage';
import { PropLayer } from './props3d';
import { col } from './util3';

export class MapScene {
  readonly group = new THREE.Group();
  readonly field: TerrainField;
  readonly tex: TerrainTextures;
  readonly liquid: Liquid | null;
  readonly foliage: Foliage;
  readonly props: PropLayer;
  private ground = new THREE.Group();
  private groundMat: THREE.MeshStandardMaterial & { tu: TerrainUniforms };
  private skirt: THREE.Mesh;
  lastUsed = 0;

  constructor(readonly map: GameMap, lib: DetailLib, q: Quality) {
    this.group.name = 'map:' + map.id;
    this.field = new TerrainField(map);
    this.tex = buildTerrainTextures(this.field);
    this.groundMat = makeTerrainMaterial(this.field, this.tex, lib);
    const relief = (map.hasElev || map.wallStyle === 'cliff') && q.id !== 'low';
    for (const geo of buildGroundGeometry(this.field, q.terrainSub)) {
      const mesh = new THREE.Mesh(geo, this.groundMat);
      mesh.receiveShadow = true;
      mesh.castShadow = relief;
      this.ground.add(mesh);
    }
    this.ground.name = 'ground';
    this.group.add(this.ground);
    const walls = buildWalls(this.field);
    if (walls) this.group.add(walls);
    const decks = buildDecks(this.field);
    if (decks) this.group.add(decks);
    this.liquid = this.field.hasLiquid ? new Liquid(this.field, this.tex, lib) : null;
    if (this.liquid) this.group.add(this.liquid.group);
    // a dark apron far below hides the world edge on maps the camera can look past
    const P = REALMS[map.realm].palette;
    const apron = new THREE.MeshBasicMaterial({ color: map.outdoor && this.field.liquidKind !== 'void' ? col(P.cliffFace).clone().multiplyScalar(0.25) : new THREE.Color(0.01, 0.012, 0.02), fog: true });
    this.skirt = new THREE.Mesh(new THREE.PlaneGeometry(map.w * TILE + 6000, map.h * TILE + 6000).rotateX(-Math.PI / 2), apron);
    this.skirt.position.set((map.w * TILE) / 2, this.field.liquidKind === 'void' ? -900 : -14, (map.h * TILE) / 2);
    this.skirt.visible = this.field.liquidKind !== 'void';
    this.group.add(this.skirt);
    this.foliage = new Foliage(this.field, lib, q);
    this.group.add(this.foliage.group);
    this.props = new PropLayer(this.field, q);
    this.group.add(this.props.group);
  }

  update(dt: number, env: Environment, focusX: number, focusZ: number): void {
    this.groundMat.tu.uWet.value = env.wet;
    this.liquid?.update(env);
    this.foliage.update(env, focusX, focusZ);
    this.props.update(dt, env);
  }

  dispose(): void {
    this.groundMat.dispose();
    this.tex.tiles.dispose();
    this.tex.shore.dispose();
    this.liquid?.dispose();
    this.foliage.dispose();
    this.props.dispose();
    this.skirt.geometry.dispose();
    (this.skirt.material as THREE.Material).dispose();
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) mesh.geometry.dispose();
    });
    this.group.removeFromParent();
  }
}
