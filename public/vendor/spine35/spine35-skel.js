/*
 * Spine 3.5.x 二进制骨架（.skel）→ JSON 转换器
 *
 * 依据官方 spine-libgdx 3.5.51 的 SkeletonBinary.java 逐段移植，
 * 输出与 Spine 3.5 JSON 导出结构一致的对象，
 * 可直接交给 spine-webgl 3.5 的 spine.SkeletonJson 建库。
 *
 * 用法：
 *   const json = Spine35Binary.toJson(arrayBuffer)
 *   const skeletonData = new spine.SkeletonJson(loader).readSkeletonData(json)
 *
 * 说明：
 *   - 仅处理 3.5 分支的二进制格式（文件头 version 形如 "3.5.51"）
 *   - 字节序与 libgdx DataInput 一致：float / int / short 均为大端，
 *     长度与索引为 varint（7 位一组，LSB 优先）
 */
(function (global) {
	'use strict'

	var ATTACHMENT_TYPES = ['region', 'boundingbox', 'mesh', 'linkedmesh', 'path', 'point', 'clipping']
	var BLEND_MODES = ['normal', 'additive', 'multiply', 'screen']
	var TRANSFORM_MODES = ['normal', 'onlyTranslation', 'noRotationOrReflection', 'noScale', 'noScaleOrReflection']
	var POSITION_MODES = ['fixed', 'percent']
	var SPACING_MODES = ['length', 'fixed', 'percent']
	var ROTATE_MODES = ['tangent', 'chain', 'chainScale']

	var SLOT_ATTACHMENT = 0
	var SLOT_COLOR = 1
	var BONE_ROTATE = 0
	var BONE_TRANSLATE = 1
	var BONE_SCALE = 2
	var BONE_SHEAR = 3
	var PATH_POSITION = 0
	var PATH_SPACING = 1
	var PATH_MIX = 2
	var CURVE_STEPPED = 1
	var CURVE_BEZIER = 2

	/** 二进制读取器（varint / 小端 float / 大端 int 等，与 libgdx DataInput 对齐） */
	function BinaryReader(buffer) {
		this.buffer = buffer
		this.bytes = new Uint8Array(buffer)
		this.view = new DataView(buffer)
		this.pos = 0
		this.decoder = new TextDecoder('utf-8')
	}

	/** varint（7 位一组，LSB 优先）；optimizePositive=false 时按 zigzag 还原负数 */
	BinaryReader.prototype.readInt = function (optimizePositive) {
		var result = 0
		var shift = 0
		var b
		do {
			b = this.bytes[this.pos++]
			result |= (b & 0x7f) << shift
			shift += 7
		} while ((b & 0x80) !== 0)
		result = result >>> 0
		if (optimizePositive === false)
			result = (result >>> 1) ^ -(result & 1)
		return result
	}

	/** 4 字节大端 int（颜色、事件 int 等用这个） */
	BinaryReader.prototype.readInt32 = function () {
		var v = this.view.getInt32(this.pos)
		this.pos += 4
		return v
	}

	BinaryReader.prototype.readShort = function () {
		// libgdx DataInput 为大端
		var v = this.view.getInt16(this.pos)
		this.pos += 2
		return v
	}

	BinaryReader.prototype.readFloat = function () {
		// libgdx DataOutput.writeFloat = writeInt(floatToIntBits)，即大端 float32
		var v = this.view.getFloat32(this.pos)
		this.pos += 4
		return v
	}

	BinaryReader.prototype.readBoolean = function () {
		return this.bytes[this.pos++] !== 0
	}

	BinaryReader.prototype.readByte = function () {
		var v = this.view.getInt8(this.pos)
		this.pos += 1
		return v
	}

	/** UTF-8 字符串：varint 长度（0=null，1=""，其余 length-1） */
	BinaryReader.prototype.readString = function () {
		var n = this.readInt(true)
		if (n === 0)
			return null
		if (n === 1)
			return ''
		var count = n - 1
		var str = this.decoder.decode(this.bytes.subarray(this.pos, this.pos + count))
		this.pos += count
		return str
	}

	/** RGBA8888 → "rrggbbaa"（Spine 3.5 JSON 颜色格式） */
	function rgbaToHex(rgba) {
		var r = (rgba >>> 24) & 0xff
		var g = (rgba >>> 16) & 0xff
		var b = (rgba >>> 8) & 0xff
		var a = rgba & 0xff
		return [r, g, b, a].map(function (n) {
			return (n < 16 ? '0' : '') + n.toString(16)
		}).join('')
	}

	function readFloatArray(reader, n) {
		var arr = new Array(n)
		for (var i = 0; i < n; i++)
			arr[i] = reader.readFloat()
		return arr
	}

	function readShortArray(reader) {
		var n = reader.readInt(true)
		var arr = new Array(n)
		for (var i = 0; i < n; i++)
			arr[i] = reader.readShort()
		return arr
	}

	/**
	 * 读取顶点数据
	 * @returns {{ vertices: number[], weighted: boolean }}
	 *  - 非权重网格：顶点 x,y 扁平数组
	 *  - 权重网格：每个顶点 [boneCount, boneIndex, x, y, weight, ...] 扁平数组（与 JSON 导出一致）
	 */
	function readVertices(reader, vertexCount) {
		var verticesLength = vertexCount << 1
		var weighted = reader.readBoolean()
		if (!weighted)
			return { vertices: readFloatArray(reader, verticesLength), weighted: false }

		var out = []
		for (var i = 0; i < vertexCount; i++) {
			var boneCount = reader.readInt(true)
			out.push(boneCount)
			for (var ii = 0; ii < boneCount; ii++) {
				out.push(reader.readInt(true))
				out.push(reader.readFloat())
				out.push(reader.readFloat())
				out.push(reader.readFloat())
			}
		}
		return { vertices: out, weighted: true }
	}

	/** 读取一个附件；linkedmesh 会推入 ctx.linked，交由运行时自己按名字挂接 */
	function readAttachment(reader, ctx, attachmentName, nonessential) {
		var name = reader.readString()
		if (name === null)
			name = attachmentName

		var type = ATTACHMENT_TYPES[reader.readByte()]

		if (type === 'region') {
			var path = reader.readString()
			var rotation = reader.readFloat()
			var x = reader.readFloat()
			var y = reader.readFloat()
			var scaleX = reader.readFloat()
			var scaleY = reader.readFloat()
			var width = reader.readFloat()
			var height = reader.readFloat()
			var color = rgbaToHex(reader.readInt32())
			if (path === null)
				path = name
			var att = {
				type: 'region',
				name: name,
				rotation: rotation,
				x: x,
				y: y,
				scaleX: scaleX,
				scaleY: scaleY,
				width: width,
				height: height,
				color: color,
			}
			if (path !== name)
				att.path = path
			return att
		}

		if (type === 'boundingbox') {
			var boxCount = reader.readInt(true)
			var boxVerts = readVertices(reader, boxCount)
			var boxAtt = {
				type: 'boundingbox',
				name: name,
				vertexCount: boxCount,
				vertices: boxVerts.vertices,
			}
			if (nonessential)
				boxAtt.color = rgbaToHex(reader.readInt32())
			return boxAtt
		}

		if (type === 'mesh') {
			var meshPath = reader.readString()
			var meshColor = rgbaToHex(reader.readInt32())
			var meshCount = reader.readInt(true)
			var uvs = readFloatArray(reader, meshCount << 1)
			var triangles = readShortArray(reader)
			var meshVerts = readVertices(reader, meshCount)
			var hull = reader.readInt(true)
			var edges = null
			var meshW = 0
			var meshH = 0
			if (nonessential) {
				edges = readShortArray(reader)
				meshW = reader.readFloat()
				meshH = reader.readFloat()
			}
			if (meshPath === null)
				meshPath = name
			var meshAtt = {
				type: 'mesh',
				name: name,
				uvs: uvs,
				triangles: triangles,
				vertices: meshVerts.vertices,
				hull: hull,
				color: meshColor,
			}
			if (meshPath !== name)
				meshAtt.path = meshPath
			if (nonessential) {
				meshAtt.edges = edges
				meshAtt.width = meshW
				meshAtt.height = meshH
			}
			return meshAtt
		}

		if (type === 'linkedmesh') {
			var linkPath = reader.readString()
			var linkColor = rgbaToHex(reader.readInt32())
			var skinName = reader.readString()
			var parent = reader.readString()
			var inheritDeform = reader.readBoolean()
			var linkW = 0
			var linkH = 0
			if (nonessential) {
				linkW = reader.readFloat()
				linkH = reader.readFloat()
			}
			if (linkPath === null)
				linkPath = name
			var linkAtt = {
				type: 'linkedmesh',
				name: name,
				color: linkColor,
				deform: inheritDeform,
				parent: parent,
			}
			if (skinName !== null)
				linkAtt.skin = skinName
			if (linkPath !== name)
				linkAtt.path = linkPath
			if (nonessential) {
				linkAtt.width = linkW
				linkAtt.height = linkH
			}
			return linkAtt
		}

		if (type === 'path') {
			var closed = reader.readBoolean()
			var constantSpeed = reader.readBoolean()
			var pathCount = reader.readInt(true)
			var pathVerts = readVertices(reader, pathCount)
			var lengths = new Array(Math.floor(pathCount / 3))
			for (var li = 0; li < lengths.length; li++)
				lengths[li] = reader.readFloat()
			var pathAtt = {
				type: 'path',
				name: name,
				closed: closed,
				constantSpeed: constantSpeed,
				vertexCount: pathCount,
				vertices: pathVerts.vertices,
				lengths: lengths,
			}
			if (nonessential)
				pathAtt.color = rgbaToHex(reader.readInt32())
			return pathAtt
		}

		// point / clipping 在 3.5 中不参与渲染
		return null
	}

	/** 读取一条曲线（第 frameIndex 帧与下一帧之间），写入 frame.curve */
	function readCurve(reader, frame) {
		var type = reader.readByte()
		if (type === CURVE_STEPPED)
			frame.curve = 'stepped'
		else if (type === CURVE_BEZIER)
			frame.curve = [reader.readFloat(), reader.readFloat(), reader.readFloat(), reader.readFloat()]
	}

	var Skeleton35Binary = {
		/**
		 * 把 3.5 二进制骨架转换为 Spine 3.5 JSON 对象
		 * @param {ArrayBuffer} buffer
		 * @returns {object} JSON 骨架数据
		 */
		toJson: function (buffer) {
			var reader = new BinaryReader(buffer)
			var json = {}
			var skeleton = (json.skeleton = {})

			skeleton.hash = reader.readString()
			skeleton.spine = reader.readString()
			skeleton.width = reader.readFloat()
			skeleton.height = reader.readFloat()
			var nonessential = reader.readBoolean()
			if (nonessential) {
				skeleton.fps = reader.readFloat()
				skeleton.images = reader.readString()
			}

			// Bones
			var bones = (json.bones = [])
			var boneNames = []
			for (var i = 0, n = reader.readInt(true); i < n; i++) {
				var boneName = reader.readString()
				var bone = { name: boneName }
				if (i > 0)
					bone.parent = boneNames[reader.readInt(true)]
				bone.rotation = reader.readFloat()
				bone.x = reader.readFloat()
				bone.y = reader.readFloat()
				bone.scaleX = reader.readFloat()
				bone.scaleY = reader.readFloat()
				bone.shearX = reader.readFloat()
				bone.shearY = reader.readFloat()
				bone.length = reader.readFloat()
				bone.transform = TRANSFORM_MODES[reader.readInt(true)] || 'normal'
				if (nonessential)
					bone.color = rgbaToHex(reader.readInt32())
				boneNames.push(boneName)
				bones.push(bone)
			}

			// Slots
			var slots = (json.slots = [])
			var slotNames = []
			for (var si = 0, sn = reader.readInt(true); si < sn; si++) {
				var slotName = reader.readString()
				var slotBone = boneNames[reader.readInt(true)]
				var slotColor = rgbaToHex(reader.readInt32())
				var attachmentName = reader.readString()
				var blend = BLEND_MODES[reader.readInt(true)] || 'normal'
				var slot = { name: slotName, bone: slotBone, color: slotColor, blend: blend }
				if (attachmentName !== null)
					slot.attachment = attachmentName
				slotNames.push(slotName)
				slots.push(slot)
			}

			// IK constraints
			var iks = (json.ik = [])
			for (var ii = 0, ikn = reader.readInt(true); ii < ikn; ii++) {
				var ikName = reader.readString()
				var ikOrder = reader.readInt(true)
				var ikBones = []
				for (var ib = 0, ikbn = reader.readInt(true); ib < ikbn; ib++)
					ikBones.push(boneNames[reader.readInt(true)])
				var ikTarget = boneNames[reader.readInt(true)]
				var ikMix = reader.readFloat()
				var bendDirection = reader.readByte()
				iks.push({
					name: ikName,
					order: ikOrder,
					bones: ikBones,
					target: ikTarget,
					mix: ikMix,
					bendPositive: bendDirection !== -1,
				})
			}

			// Transform constraints
			var transforms = (json.transform = [])
			for (var ti = 0, tn = reader.readInt(true); ti < tn; ti++) {
				var tcName = reader.readString()
				var tcOrder = reader.readInt(true)
				var tcBones = []
				for (var tb = 0, tbn = reader.readInt(true); tb < tbn; tb++)
					tcBones.push(boneNames[reader.readInt(true)])
				var tcTarget = boneNames[reader.readInt(true)]
				transforms.push({
					name: tcName,
					order: tcOrder,
					bones: tcBones,
					target: tcTarget,
					rotation: reader.readFloat(),
					x: reader.readFloat(),
					y: reader.readFloat(),
					scaleX: reader.readFloat(),
					scaleY: reader.readFloat(),
					shearY: reader.readFloat(),
					rotateMix: reader.readFloat(),
					translateMix: reader.readFloat(),
					scaleMix: reader.readFloat(),
					shearMix: reader.readFloat(),
				})
			}

			// Path constraints
			var paths = (json.path = [])
			for (var pi = 0, pn = reader.readInt(true); pi < pn; pi++) {
				var pcName = reader.readString()
				var pcOrder = reader.readInt(true)
				var pcBones = []
				for (var pb = 0, pbn = reader.readInt(true); pb < pbn; pb++)
					pcBones.push(boneNames[reader.readInt(true)])
				var pcTarget = slotNames[reader.readInt(true)]
				var positionMode = POSITION_MODES[reader.readInt(true)] || 'percent'
				var spacingMode = SPACING_MODES[reader.readInt(true)] || 'length'
				var rotateMode = ROTATE_MODES[reader.readInt(true)] || 'tangent'
				paths.push({
					name: pcName,
					order: pcOrder,
					bones: pcBones,
					target: pcTarget,
					positionMode: positionMode,
					spacingMode: spacingMode,
					rotateMode: rotateMode,
					rotation: reader.readFloat(),
					position: reader.readFloat(),
					spacing: reader.readFloat(),
					rotateMix: reader.readFloat(),
					translateMix: reader.readFloat(),
				})
			}

			var ctx = { linkedMeshes: [] }

			// Skins
			var skins = (json.skins = {})
			var skinNames = []
			var defaultSkin = readSkin(reader, ctx, 'default', nonessential, slotNames)
			if (defaultSkin) {
				skins.default = defaultSkin
				skinNames.push('default')
			}
			for (var ki = 0, kn = reader.readInt(true); ki < kn; ki++) {
				var extraName = reader.readString()
				skins[extraName] = readSkin(reader, ctx, extraName, nonessential, slotNames)
				skinNames.push(extraName)
			}

			// Events
			var events = (json.events = {})
			var eventNames = []
			for (var ei = 0, en = reader.readInt(true); ei < en; ei++) {
				var eventName = reader.readString()
				var intValue = reader.readInt(false)
				var floatValue = reader.readFloat()
				var stringValue = reader.readString()
				var evt = { int: intValue, float: floatValue }
				if (stringValue !== null)
					evt.string = stringValue
				events[eventName] = evt
				eventNames.push(eventName)
			}

			// Animations
			var animations = (json.animations = {})
			for (var ai = 0, an = reader.readInt(true); ai < an; ai++) {
				var animName = reader.readString()
				animations[animName] = readAnimation(reader, {
					slotNames: slotNames,
					boneNames: boneNames,
					ikNames: iks.map(function (c) { return c.name }),
					transformNames: transforms.map(function (c) { return c.name }),
					pathNames: paths.map(function (c) { return c.name }),
					pathData: paths,
					slotCount: slotNames.length,
					skinNames: skinNames,
					eventNames: eventNames,
				})
			}

			return json
		},
	}

	/** 读取一个皮肤（slotCount=0 返回 null） */
	function readSkin(reader, ctx, skinName, nonessential, slotNames) {
		var slotCount = reader.readInt(true)
		if (slotCount === 0)
			return null
		var skin = {}
		for (var i = 0; i < slotCount; i++) {
			var slotIndex = reader.readInt(true)
			var slotKey = slotNames[slotIndex]
			var slotMap = skin[slotKey] = {}
			for (var ii = 0, nn = reader.readInt(true); ii < nn; ii++) {
				var attName = reader.readString()
				var att = readAttachment(reader, ctx, attName, nonessential)
				if (att)
					slotMap[att.name] = att
			}
		}
		return skin
	}

	/** 读取一条动画：严格按 槽位 → 骨骼 → IK → 变换 → 路径 → 变形 → 绘制顺序 → 事件 的顺序 */
	function readAnimation(reader, ctx) {
		var animation = {}

		// Slot timelines
		var slotTimelines = null
		for (var i = 0, n = reader.readInt(true); i < n; i++) {
			var slotIndex = reader.readInt(true)
			var slotName = ctx.slotNames[slotIndex]
			for (var ii = 0, nn = reader.readInt(true); ii < nn; ii++) {
				var type = reader.readByte()
				var frameCount = reader.readInt(true)
				if (type === SLOT_COLOR) {
					var colorFrames = []
					for (var f = 0; f < frameCount; f++) {
						var cf = { time: reader.readFloat(), color: rgbaToHex(reader.readInt32()) }
						if (f < frameCount - 1)
							readCurve(reader, cf)
						colorFrames.push(cf)
					}
					setTimeline(animation, 'slots', slotName, 'color', colorFrames)
				}
				else if (type === SLOT_ATTACHMENT) {
					var attFrames = []
					for (var af = 0; af < frameCount; af++) {
						var frame = { time: reader.readFloat() }
						var name = reader.readString()
						if (name !== null)
							frame.name = name
						attFrames.push(frame)
					}
					setTimeline(animation, 'slots', slotName, 'attachment', attFrames)
				}
			}
		}

		// Bone timelines
		for (var bi = 0, bn = reader.readInt(true); bi < bn; bi++) {
			var boneIndex = reader.readInt(true)
			var boneName = ctx.boneNames[boneIndex]
			for (var bj = 0, bjn = reader.readInt(true); bj < bjn; bj++) {
				var btype = reader.readByte()
				var bframeCount = reader.readInt(true)
				if (btype === BONE_ROTATE) {
					var rotateFrames = []
					for (var rf = 0; rf < bframeCount; rf++) {
						var rframe = { time: reader.readFloat(), angle: reader.readFloat() }
						if (rf < bframeCount - 1)
							readCurve(reader, rframe)
						rotateFrames.push(rframe)
					}
					setTimeline(animation, 'bones', boneName, 'rotate', rotateFrames)
				}
				else {
					var timelineName = btype === BONE_TRANSLATE ? 'translate' : btype === BONE_SCALE ? 'scale' : 'shear'
					var xyFrames = []
					for (var xf = 0; xf < bframeCount; xf++) {
						var xyFrame = { time: reader.readFloat(), x: reader.readFloat(), y: reader.readFloat() }
						if (xf < bframeCount - 1)
							readCurve(reader, xyFrame)
						xyFrames.push(xyFrame)
					}
					setTimeline(animation, 'bones', boneName, timelineName, xyFrames)
				}
			}
		}

		// IK constraint timelines
		for (var iki = 0, ikn = reader.readInt(true); iki < ikn; iki++) {
			var ikIndex = reader.readInt(true)
			var ikName = ctx.ikNames[ikIndex]
			var ikFrameCount = reader.readInt(true)
			var ikFrames = []
			for (var ikf = 0; ikf < ikFrameCount; ikf++) {
				var ikFrame = {
					time: reader.readFloat(),
					mix: reader.readFloat(),
					bendPositive: reader.readByte() !== -1,
				}
				if (ikf < ikFrameCount - 1)
					readCurve(reader, ikFrame)
				ikFrames.push(ikFrame)
			}
			animation.ik = animation.ik || {}
			animation.ik[ikName] = ikFrames
		}

		// Transform constraint timelines
		for (var tci = 0, tcn = reader.readInt(true); tci < tcn; tci++) {
			var tcIndex = reader.readInt(true)
			var tcName = ctx.transformNames[tcIndex]
			var tcFrameCount = reader.readInt(true)
			var tcFrames = []
			for (var tcf = 0; tcf < tcFrameCount; tcf++) {
				var tcFrame = {
					time: reader.readFloat(),
					rotateMix: reader.readFloat(),
					translateMix: reader.readFloat(),
					scaleMix: reader.readFloat(),
					shearMix: reader.readFloat(),
				}
				if (tcf < tcFrameCount - 1)
					readCurve(reader, tcFrame)
				tcFrames.push(tcFrame)
			}
			animation.transform = animation.transform || {}
			animation.transform[tcName] = tcFrames
		}

		// Path constraint timelines
		for (var pci = 0, pcn = reader.readInt(true); pci < pcn; pci++) {
			var pcIndex = reader.readInt(true)
			var pcName = ctx.pathNames[pcIndex]
			for (var pt = 0, ptn = reader.readInt(true); pt < ptn; pt++) {
				var ptype = reader.readByte()
				var pFrameCount = reader.readInt(true)
				if (ptype === PATH_POSITION || ptype === PATH_SPACING) {
					var pkey = ptype === PATH_POSITION ? 'position' : 'spacing'
					var pFrames = []
					for (var pf = 0; pf < pFrameCount; pf++) {
						var pFrame = { time: reader.readFloat() }
						pFrame[pkey] = reader.readFloat()
						if (pf < pFrameCount - 1)
							readCurve(reader, pFrame)
						pFrames.push(pFrame)
					}
					animation.paths = animation.paths || {}
					animation.paths[pcName] = animation.paths[pcName] || {}
					animation.paths[pcName][pkey] = pFrames
				}
				else if (ptype === PATH_MIX) {
					var pmFrames = []
					for (var pmf = 0; pmf < pFrameCount; pmf++) {
						var pmFrame = {
							time: reader.readFloat(),
							rotateMix: reader.readFloat(),
							translateMix: reader.readFloat(),
						}
						if (pmf < pFrameCount - 1)
							readCurve(reader, pmFrame)
						pmFrames.push(pmFrame)
					}
					animation.paths = animation.paths || {}
					animation.paths[pcName] = animation.paths[pcName] || {}
					animation.paths[pcName].mix = pmFrames
				}
			}
		}

		// Deform timelines
		for (var dfi = 0, dfn = reader.readInt(true); dfi < dfn; dfi++) {
			var skinIndex = reader.readInt(true)
			var skinName = ctx.skinNames[skinIndex] || 'default'
			for (var ds = 0, dsn = reader.readInt(true); ds < dsn; ds++) {
				var dslotIndex = reader.readInt(true)
				var dslotName = ctx.slotNames[dslotIndex]
				for (var da = 0, dan = reader.readInt(true); da < dan; da++) {
					var attName = reader.readString()
					var dFrameCount = reader.readInt(true)
					var dFrames = []
					for (var df = 0; df < dFrameCount; df++) {
						var dFrame = { time: reader.readFloat() }
						var end = reader.readInt(true)
						if (end !== 0) {
							var start = reader.readInt(true)
							var values = new Array(end)
							for (var v = 0; v < end; v++)
								values[v] = reader.readFloat()
							dFrame.offset = start
							dFrame.vertices = values
						}
						if (df < dFrameCount - 1)
							readCurve(reader, dFrame)
						dFrames.push(dFrame)
					}
					animation.deform = animation.deform || {}
					animation.deform[skinName] = animation.deform[skinName] || {}
					animation.deform[skinName][dslotName] = animation.deform[skinName][dslotName] || {}
					animation.deform[skinName][dslotName][attName] = dFrames
				}
			}
		}

		// Draw order timeline
		var drawOrderCount = reader.readInt(true)
		if (drawOrderCount > 0) {
			var drawFrames = []
			for (var dof = 0; dof < drawOrderCount; dof++) {
				var frameTime = reader.readFloat()
				var offsetCount = reader.readInt(true)
				var offsets = []
				for (var oc = 0; oc < offsetCount; oc++) {
					var oSlotIndex = reader.readInt(true)
					var oOffset = reader.readInt(true)
					offsets.push({ slot: ctx.slotNames[oSlotIndex], offset: oOffset })
				}
				drawFrames.push({ time: frameTime, offsets: offsets })
			}
			animation.drawOrder = drawFrames
		}

		// Event timeline
		var eventCount = reader.readInt(true)
		if (eventCount > 0) {
			var eventFrames = []
			for (var ef = 0; ef < eventCount; ef++) {
				var eventFrame = {
					time: reader.readFloat(),
					name: ctx.eventNames[reader.readInt(true)],
					int: reader.readInt(false),
					float: reader.readFloat(),
				}
				if (reader.readBoolean())
					eventFrame.string = reader.readString()
				eventFrames.push(eventFrame)
			}
			animation.events = eventFrames
		}

		return animation
	}

	/** animation[group][key][timelineName] = frames */
	function setTimeline(animation, group, key, timelineName, frames) {
		animation[group] = animation[group] || {}
		animation[group][key] = animation[group][key] || {}
		animation[group][key][timelineName] = frames
	}

	global.Spine35Binary = Skeleton35Binary
})(typeof window !== 'undefined' ? window : this)
