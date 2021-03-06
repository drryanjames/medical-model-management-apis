[Medical Model Management APIs](../README.md) > [TestCollateral](../classes/testcollateral.md)

# Class: TestCollateral

Shortcusts to files in the test collateral dir

## Hierarchy

**TestCollateral**

## Index

### Properties

* [BlenderImage](testcollateral.md#blenderimage)
* [CubeWithTexture_FBX](testcollateral.md#cubewithtexture_fbx)
* [Cube_FBX](testcollateral.md#cube_fbx)
* [Cube_MTL](testcollateral.md#cube_mtl)
* [Cube_OBJ](testcollateral.md#cube_obj)

### Methods

* [createTestFile](testcollateral.md#createtestfile)

---

## Properties

<a id="blenderimage"></a>

### `<Static>` BlenderImage

**● BlenderImage**: *`File`* =  TestCollateral.createTestFile('blender.png', 'image/png')

*Defined in [tests/testUtils.ts:48](https://github.com/drryanjames/medical-model-management-apis/blob/53e4d53/src/tests/testUtils.ts#L48)*

___
<a id="cubewithtexture_fbx"></a>

### `<Static>` CubeWithTexture_FBX

**● CubeWithTexture_FBX**: *`File`* =  TestCollateral.createTestFile('cube_with_img.fbx', 'application/octet-stream')

*Defined in [tests/testUtils.ts:52](https://github.com/drryanjames/medical-model-management-apis/blob/53e4d53/src/tests/testUtils.ts#L52)*

___
<a id="cube_fbx"></a>

### `<Static>` Cube_FBX

**● Cube_FBX**: *`File`* =  TestCollateral.createTestFile('cube.fbx', 'application/octet-stream')

*Defined in [tests/testUtils.ts:49](https://github.com/drryanjames/medical-model-management-apis/blob/53e4d53/src/tests/testUtils.ts#L49)*

___
<a id="cube_mtl"></a>

### `<Static>` Cube_MTL

**● Cube_MTL**: *`File`* =  TestCollateral.createTestFile('cube.mtl', 'text/plain')

*Defined in [tests/testUtils.ts:50](https://github.com/drryanjames/medical-model-management-apis/blob/53e4d53/src/tests/testUtils.ts#L50)*

___
<a id="cube_obj"></a>

### `<Static>` Cube_OBJ

**● Cube_OBJ**: *`File`* =  TestCollateral.createTestFile('cube.obj', 'text/plain')

*Defined in [tests/testUtils.ts:51](https://github.com/drryanjames/medical-model-management-apis/blob/53e4d53/src/tests/testUtils.ts#L51)*

___

## Methods

<a id="createtestfile"></a>

### `<Static>` createTestFile

▸ **createTestFile**(filename: *`string`*, mimeType: *`string`*): `File`

*Defined in [tests/testUtils.ts:55](https://github.com/drryanjames/medical-model-management-apis/blob/53e4d53/src/tests/testUtils.ts#L55)*

Creates a test mesh file

**Parameters:**

| Param | Type |
| ------ | ------ |
| filename | `string` |
| mimeType | `string` |

**Returns:** `File`

___

