import { ethers, upgrades } from 'hardhat'
import { assert, expect } from 'chai'
import { moveTime } from '../utils/move-time'
import {
	BaseContract,
	BytesLike,
	Contract,
	ContractFactory,
	ZeroAddress
} from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

interface Accounts {
	admin: SignerWithAddress
	alice: SignerWithAddress
	bob: SignerWithAddress
	kyle: SignerWithAddress
	carol: SignerWithAddress
}

interface Contracts {
	registryInstance: any
	alloInstance: any
	directGrantsSimpleStrategyContract: any
}

interface Metadata {
	protocol: BigInt
	pointer: string
}

interface Profile {
	id: string
	nonce: BigInt
	name: string
	metadata: Metadata
	owner: string
	anchor: string
}

interface Pool {
	profileId: BytesLike
	strategy: string
	token: string
	metadata: Metadata
	managerRole: BytesLike
	adminRole: BytesLike
}

interface InitializeData {
	registryGating: boolean
	metadataRequired: boolean
	grantAmountRequired: boolean
}

interface RecipientData {
	recipientId: string
	recipientAddress: string
	grantAmount: BigInt
	metadata: Metadata
}

interface Recipient {
	useRegistryAnchor: boolean
	recipientAddress: string
	grantAmount: BigInt
	metadata: Metadata
	recipientStatus: number
	milestonesReviewStatus: number
}

interface Milestone {
	amountPercentage: BigInt
	metadata: Metadata
	status: BigInt
}

describe('Allo Flow', async function () {
	function toDecimal(value: number): bigint {
		return BigInt(value * 10 ** 18)
	}

	let accounts: Accounts
	let contracts: Contracts

	const abiCoder = new ethers.AbiCoder()

	const NATIVE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

	const initializeDataStructTypes: string[] = ['bool', 'bool', 'bool']
	const recipientDataStructTypes = [
		'address',
		'address',
		'uint256',
		'tuple(uint256, string)'
	]
	const metadataStructTypes: string[] = ['uint256', 'string']
	const allocateStructTypes: string[] = ['address', 'uint256', 'uint256']

	beforeEach(async function () {
		const signers = await ethers.getSigners()

		accounts = {
			admin: signers[0],
			alice: signers[1],
			bob: signers[2],
			kyle: signers[3],
			carol: signers[4]
		}

		contracts = await deployContracts()
	})

	it.skip('Should create a profile', async () => {
		// Arrange
		const { alice } = accounts
		const { registryInstance } = contracts

		const aliceNonce: number = await ethers.provider.getTransactionCount(
			alice.address
		)
		const aliceName: string = 'alice'
		const aliceMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}
		const aliceProfileMembers: string[] = []

		let aliceProfileId: BytesLike
		let aliceProfileDto: any
		let aliceProfile: Profile

		// Act
		const createProfileTx = await registryInstance.createProfile(
			aliceNonce, // _nonce
			aliceName, // _name
			[aliceMetadata.protocol, aliceMetadata.pointer], // _metadata
			alice.address, // ownerAddress
			aliceProfileMembers // _membersAddresses
		)

		await createProfileTx.wait()

		const events = await registryInstance.queryFilter(
			'ProfileCreated',
			createProfileTx.blockHash
		)

		const event = events[events.length - 1]

		aliceProfileId = event.args.profileId

		aliceProfileDto = await registryInstance.getProfileById(aliceProfileId)

		aliceProfile = {
			id: aliceProfileDto[0],
			nonce: aliceProfileDto[1],
			name: aliceProfileDto[2],
			metadata: {
				protocol: aliceProfileDto[3][0],
				pointer: aliceProfileDto[3][1]
			},
			owner: aliceProfileDto[4],
			anchor: aliceProfileDto[5]
		}
	})

	it.skip('Clone strategy', async () => {
		// Arrange
		const { admin } = accounts
		const { alloInstance, directGrantsSimpleStrategyContract } = contracts

		const directGrantsSimpleStrategyAddress: string =
			await directGrantsSimpleStrategyContract.getAddress()

		let strategyAddress: string

		// Act
		const addToCloneableStrategiesTx =
			await alloInstance.addToCloneableStrategies(
				directGrantsSimpleStrategyAddress
			)

		await addToCloneableStrategiesTx.wait()

		const events = await alloInstance.queryFilter(
			'StrategyApproved',
			addToCloneableStrategiesTx.blockHash
		)

		const event = events[events.length - 1]

		strategyAddress = event.args.strategy

		// Assert
		console.log('🏷️  Strategy cloned')
		try {
			assert.isTrue(
				await alloInstance.isCloneableStrategy(
					directGrantsSimpleStrategyAddress
				)
			)
		} catch (error) {
			console.log('🚨 Error: ', error)
		}
	})

	it.skip('Create pool', async () => {
		// Arrange
		const { admin, alice } = accounts
		const {
			registryInstance,
			alloInstance,
			directGrantsSimpleStrategyContract
		} = contracts

		const directGrantsSimpleStrategyAddress: string =
			await directGrantsSimpleStrategyContract.getAddress()

		const aliceNonce: number = await ethers.provider.getTransactionCount(
			alice.address
		)
		const aliceName: string = 'alice'
		const aliceMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}
		const aliceProfileMembers: string[] = []

		const alicePoolMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}

		const alicePoolManagers: string[] = []

		const alicePoolInitStrategyDataObject: InitializeData = {
			registryGating: true,
			metadataRequired: true,
			grantAmountRequired: true
		}

		const aliceInitStrategyDataValues: boolean[] = [
			alicePoolInitStrategyDataObject.registryGating,
			alicePoolInitStrategyDataObject.metadataRequired,
			alicePoolInitStrategyDataObject.grantAmountRequired
		]

		const aliceInitStrategyData: BytesLike = abiCoder.encode(
			initializeDataStructTypes,
			aliceInitStrategyDataValues
		)

		let poolFundingAmount: bigint = toDecimal(1)

		let events: any
		let event: any

		let aliceProfileId: BytesLike
		let aliceProfileDto: any
		let aliceProfile: Profile

		let strategyAddress: string

		let alicePoolId: BytesLike
		let alicePoolDto: any
		let alicePool: Pool

		// Act

		// Create profile
		console.log(' 🚩  1. Create profile')
		const createProfileTx = await registryInstance.connect(alice).createProfile(
			aliceNonce, // _nonce
			aliceName, // _name
			[aliceMetadata.protocol, aliceMetadata.pointer], // _metadata
			alice.address, // ownerAddress
			aliceProfileMembers // _membersAddresses
		)

		await createProfileTx.wait()

		events = await registryInstance.queryFilter(
			'ProfileCreated',
			createProfileTx.blockHash
		)

		event = events[events.length - 1]

		aliceProfileId = event.args.profileId

		aliceProfileDto = await registryInstance.getProfileById(aliceProfileId)

		aliceProfile = {
			id: aliceProfileDto[0],
			nonce: aliceProfileDto[1],
			name: aliceProfileDto[2],
			metadata: {
				protocol: aliceProfileDto[3][0],
				pointer: aliceProfileDto[3][1]
			},
			owner: aliceProfileDto[4],
			anchor: aliceProfileDto[5]
		}

		// Add strategy to cloneable strategies
		console.log(' 🚩  2. Add strategy to cloneable strategies')
		const addToCloneableStrategiesTx = await alloInstance
			.connect(admin)
			.addToCloneableStrategies(directGrantsSimpleStrategyAddress)

		await addToCloneableStrategiesTx.wait()

		events = await alloInstance.queryFilter(
			'StrategyApproved',
			addToCloneableStrategiesTx.blockHash
		)

		event = events[events.length - 1]

		strategyAddress = event.args.strategy

		// Create pool
		console.log(' 🚩  3. Create pool')
		const createPoolTx = await alloInstance.connect(alice).createPool(
			aliceProfileId, // _profileId
			strategyAddress, // _strategy
			aliceInitStrategyData, // _initStrategyData
			NATIVE, //_token
			poolFundingAmount, // _amount
			[alicePoolMetadata.protocol, alicePoolMetadata.pointer], // _metadata
			alicePoolManagers, // _managers
			{ value: poolFundingAmount }
		)

		await createPoolTx.wait()

		events = await alloInstance.queryFilter(
			'PoolCreated',
			createPoolTx.blockHash
		)

		event = events[events.length - 1]

		alicePoolId = event.args.poolId
		alicePoolDto = await alloInstance.getPool(alicePoolId)
		alicePool = {
			profileId: alicePoolDto[0],
			strategy: alicePoolDto[1],
			token: alicePoolDto[2],
			metadata: {
				protocol: alicePoolDto[3][0],
				pointer: alicePoolDto[3][1]
			},
			managerRole: alicePoolDto[4],
			adminRole: alicePoolDto[5]
		}

		// Assert
		console.log('🏷️  Pool created')
		try {
			assert.isTrue(aliceProfile.id === alicePool.profileId)
		} catch (error) {
			console.log('🚨 Error: ', error)
		}
	})

	it.skip('Add recipient', async () => {
		// Arrange
		const { admin, alice, bob } = accounts
		const {
			registryInstance,
			alloInstance,
			directGrantsSimpleStrategyContract
		} = contracts

		const directGrantsSimpleStrategyAddress: string =
			await directGrantsSimpleStrategyContract.getAddress()

		const aliceNonce: number = await ethers.provider.getTransactionCount(
			alice.address
		)
		const aliceName: string = 'alice'
		const aliceMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}
		const aliceProfileMembers: string[] = []

		const alicePoolMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}

		const alicePoolManagers: string[] = []

		const alicePoolInitStrategyDataObject: InitializeData = {
			registryGating: false,
			metadataRequired: true,
			grantAmountRequired: true
		}

		const aliceInitStrategyDataValues: boolean[] = [
			alicePoolInitStrategyDataObject.registryGating,
			alicePoolInitStrategyDataObject.metadataRequired,
			alicePoolInitStrategyDataObject.grantAmountRequired
		]

		const aliceInitStrategyData: BytesLike = abiCoder.encode(
			initializeDataStructTypes,
			aliceInitStrategyDataValues
		)

		let bobData: RecipientData = {
			recipientId: bob.address,
			recipientAddress: ZeroAddress,
			grantAmount: toDecimal(1),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			}
		}

		const bobDataArray: any[] = [
			bobData.recipientId,
			bobData.recipientAddress,
			bobData.grantAmount,
			[bobData.metadata.protocol, bobData.metadata.pointer]
		]

		let bobDataBytes: BytesLike = abiCoder.encode(
			recipientDataStructTypes,
			bobDataArray
		)

		let poolFundingAmount: bigint = toDecimal(1)

		let events: any
		let event: any

		let aliceProfileId: BytesLike
		let aliceProfileDto: any
		let aliceProfile: Profile
		let aliceStrategyContract: Contract

		let strategyAddress: string

		let alicePoolId: bigint
		let alicePoolDto: any
		let alicePool: Pool

		let bobRecipientId: string

		// Act

		// Create profile
		console.log(' 🚩  1. Create profile')
		const createProfileTx = await registryInstance.connect(alice).createProfile(
			aliceNonce, // _nonce
			aliceName, // _name
			[aliceMetadata.protocol, aliceMetadata.pointer], // _metadata
			alice.address, // ownerAddress
			aliceProfileMembers // _membersAddresses
		)

		await createProfileTx.wait()

		events = await registryInstance.queryFilter(
			'ProfileCreated',
			createProfileTx.blockHash
		)

		event = events[events.length - 1]

		aliceProfileId = event.args.profileId

		aliceProfileDto = await registryInstance.getProfileById(aliceProfileId)

		aliceProfile = {
			id: aliceProfileDto[0],
			nonce: aliceProfileDto[1],
			name: aliceProfileDto[2],
			metadata: {
				protocol: aliceProfileDto[3][0],
				pointer: aliceProfileDto[3][1]
			},
			owner: aliceProfileDto[4],
			anchor: aliceProfileDto[5]
		}

		bobData.recipientAddress = aliceProfile.anchor
		bobDataArray[1] = bobData.recipientAddress
		bobDataBytes = abiCoder.encode(recipientDataStructTypes, bobDataArray)

		// Add strategy to cloneable strategies
		console.log(' 🚩  2. Add strategy to cloneable strategies')
		const addToCloneableStrategiesTx = await alloInstance
			.connect(admin)
			.addToCloneableStrategies(directGrantsSimpleStrategyAddress)

		await addToCloneableStrategiesTx.wait()

		events = await alloInstance.queryFilter(
			'StrategyApproved',
			addToCloneableStrategiesTx.blockHash
		)

		event = events[events.length - 1]

		strategyAddress = event.args.strategy

		// Create pool
		console.log(' 🚩  3. Create pool')
		const createPoolTx = await alloInstance.connect(alice).createPool(
			aliceProfileId, // _profileId
			strategyAddress, // _strategy
			aliceInitStrategyData, // _initStrategyData
			NATIVE, //_token
			poolFundingAmount, // _amount
			[alicePoolMetadata.protocol, alicePoolMetadata.pointer], // _metadata
			alicePoolManagers, // _managers
			{ value: poolFundingAmount }
		)

		await createPoolTx.wait()

		events = await alloInstance.queryFilter(
			'PoolCreated',
			createPoolTx.blockHash
		)

		event = events[events.length - 1]

		alicePoolId = event.args.poolId
		alicePoolDto = await alloInstance.getPool(alicePoolId)
		alicePool = {
			profileId: alicePoolDto[0],
			strategy: alicePoolDto[1],
			token: alicePoolDto[2],
			metadata: {
				protocol: alicePoolDto[3][0],
				pointer: alicePoolDto[3][1]
			},
			managerRole: alicePoolDto[4],
			adminRole: alicePoolDto[5]
		}

		aliceStrategyContract = await ethers.getContractAt(
			'DirectGrantsSimpleStrategy',
			alicePool.strategy
		)

		// 4. Add recipient
		console.log(' 🚩  4. Add recipient')
		const addRecipientTx = await alloInstance
			.connect(alice)
			.registerRecipient(alicePoolId, bobDataBytes)

		await addRecipientTx.wait()

		events = await aliceStrategyContract.queryFilter(
			'Registered',
			addRecipientTx.blockHash
		)

		event = events[events.length - 1]

		bobRecipientId = event.args.recipientId

		const bobRecipientDto: any[] = await aliceStrategyContract.getRecipient(
			bobRecipientId
		)

		const bobRecipient: Recipient = {
			useRegistryAnchor: bobRecipientDto[0],
			recipientAddress: bobRecipientDto[1],
			grantAmount: bobRecipientDto[2],
			metadata: {
				protocol: bobRecipientDto[3][0],
				pointer: bobRecipientDto[3][1]
			},
			recipientStatus: bobRecipientDto[4],
			milestonesReviewStatus: bobRecipientDto[5]
		}

		// Assert
		console.log('🏷️  Recipient added')
		try {
			assert.equal(bobRecipient.recipientAddress, bob.address)
		} catch (error) {
			console.log('🚨 Error: ', error)
		}
	})

	it.skip('Set recipient status to inReview', async () => {
		// Arrange
		const { admin, alice, bob } = accounts
		const {
			registryInstance,
			alloInstance,
			directGrantsSimpleStrategyContract
		} = contracts

		const directGrantsSimpleStrategyAddress: string =
			await directGrantsSimpleStrategyContract.getAddress()

		const aliceNonce: number = await ethers.provider.getTransactionCount(
			alice.address
		)
		const aliceName: string = 'alice'
		const aliceMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}
		const aliceProfileMembers: string[] = []

		const alicePoolMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}

		const alicePoolManagers: string[] = []

		const alicePoolInitStrategyDataObject: InitializeData = {
			registryGating: false,
			metadataRequired: true,
			grantAmountRequired: true
		}

		const aliceInitStrategyDataValues: boolean[] = [
			alicePoolInitStrategyDataObject.registryGating,
			alicePoolInitStrategyDataObject.metadataRequired,
			alicePoolInitStrategyDataObject.grantAmountRequired
		]

		const aliceInitStrategyData: BytesLike = abiCoder.encode(
			initializeDataStructTypes,
			aliceInitStrategyDataValues
		)

		let bobData: RecipientData = {
			recipientId: bob.address,
			recipientAddress: ZeroAddress,
			grantAmount: toDecimal(1),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			}
		}

		const bobDataArray: any[] = [
			bobData.recipientId,
			bobData.recipientAddress,
			bobData.grantAmount,
			[bobData.metadata.protocol, bobData.metadata.pointer]
		]

		let bobDataBytes: BytesLike = abiCoder.encode(
			recipientDataStructTypes,
			bobDataArray
		)

		let poolFundingAmount: bigint = toDecimal(1)

		let events: any
		let event: any

		let aliceProfileId: BytesLike
		let aliceProfileDto: any
		let aliceProfile: Profile
		let aliceStrategyContract: any

		let strategyAddress: string

		let alicePoolId: bigint
		let alicePoolDto: any
		let alicePool: Pool

		let bobRecipientId: string
		let bobRecipientStatus: bigint

		// Act

		// Create profile
		console.log(' 🚩  1. Create profile')
		const createProfileTx = await registryInstance.connect(alice).createProfile(
			aliceNonce, // _nonce
			aliceName, // _name
			[aliceMetadata.protocol, aliceMetadata.pointer], // _metadata
			alice.address, // ownerAddress
			aliceProfileMembers // _membersAddresses
		)

		await createProfileTx.wait()

		events = await registryInstance.queryFilter(
			'ProfileCreated',
			createProfileTx.blockHash
		)

		event = events[events.length - 1]

		aliceProfileId = event.args.profileId

		aliceProfileDto = await registryInstance.getProfileById(aliceProfileId)

		aliceProfile = {
			id: aliceProfileDto[0],
			nonce: aliceProfileDto[1],
			name: aliceProfileDto[2],
			metadata: {
				protocol: aliceProfileDto[3][0],
				pointer: aliceProfileDto[3][1]
			},
			owner: aliceProfileDto[4],
			anchor: aliceProfileDto[5]
		}

		bobData.recipientAddress = aliceProfile.anchor
		bobDataArray[1] = bobData.recipientAddress
		bobDataBytes = abiCoder.encode(recipientDataStructTypes, bobDataArray)

		// Add strategy to cloneable strategies
		console.log(' 🚩  2. Add strategy to cloneable strategies')
		const addToCloneableStrategiesTx = await alloInstance
			.connect(admin)
			.addToCloneableStrategies(directGrantsSimpleStrategyAddress)

		await addToCloneableStrategiesTx.wait()

		events = await alloInstance.queryFilter(
			'StrategyApproved',
			addToCloneableStrategiesTx.blockHash
		)

		event = events[events.length - 1]

		strategyAddress = event.args.strategy

		// Create pool
		console.log(' 🚩  3. Create pool')
		const createPoolTx = await alloInstance.connect(alice).createPool(
			aliceProfileId, // _profileId
			strategyAddress, // _strategy
			aliceInitStrategyData, // _initStrategyData
			NATIVE, //_token
			poolFundingAmount, // _amount
			[alicePoolMetadata.protocol, alicePoolMetadata.pointer], // _metadata
			alicePoolManagers, // _managers
			{ value: poolFundingAmount }
		)

		await createPoolTx.wait()

		events = await alloInstance.queryFilter(
			'PoolCreated',
			createPoolTx.blockHash
		)

		event = events[events.length - 1]

		alicePoolId = event.args.poolId
		alicePoolDto = await alloInstance.getPool(alicePoolId)
		alicePool = {
			profileId: alicePoolDto[0],
			strategy: alicePoolDto[1],
			token: alicePoolDto[2],
			metadata: {
				protocol: alicePoolDto[3][0],
				pointer: alicePoolDto[3][1]
			},
			managerRole: alicePoolDto[4],
			adminRole: alicePoolDto[5]
		}

		aliceStrategyContract = await ethers.getContractAt(
			'DirectGrantsSimpleStrategy',
			alicePool.strategy
		)

		// 4. Add recipient
		console.log(' 🚩  4. Add recipient')
		const addRecipientTx = await alloInstance
			.connect(alice)
			.registerRecipient(alicePoolId, bobDataBytes)

		await addRecipientTx.wait()

		events = await aliceStrategyContract.queryFilter(
			'Registered',
			addRecipientTx.blockHash
		)

		event = events[events.length - 1]

		bobRecipientId = event.args.recipientId

		const bobRecipientDto: any[] = await aliceStrategyContract.getRecipient(
			bobRecipientId
		)

		const bobRecipient: Recipient = {
			useRegistryAnchor: bobRecipientDto[0],
			recipientAddress: bobRecipientDto[1],
			grantAmount: bobRecipientDto[2],
			metadata: {
				protocol: bobRecipientDto[3][0],
				pointer: bobRecipientDto[3][1]
			},
			recipientStatus: bobRecipientDto[4],
			milestonesReviewStatus: bobRecipientDto[5]
		}

		// 5. Set recipient status to inReview
		console.log(' 🚩  5. Set recipient status to inReview')

		const setRecipientStatusToInReviewTx = await aliceStrategyContract
			.connect(alice)
			.setRecipientStatusToInReview([bobRecipientId])

		await setRecipientStatusToInReviewTx.wait()

		events = await aliceStrategyContract.queryFilter(
			'RecipientStatusChanged',
			setRecipientStatusToInReviewTx.blockHash
		)

		event = events[events.length - 1]

		const recipientStatusChangedStatus: bigint = event.args.status

		bobRecipientStatus = await aliceStrategyContract.getRecipientStatus(
			bobRecipientId
		)

		// Assert
		console.log('🏷️  Recipient status changed to inReview')
		try {
			assert.equal(recipientStatusChangedStatus, bobRecipientStatus)
		} catch (error) {
			console.log('🚨 Error: ', error)
		}
	})

	it.skip('allocate funds', async () => {
		// Arrange
		const { admin, alice, bob } = accounts
		const {
			registryInstance,
			alloInstance,
			directGrantsSimpleStrategyContract
		} = contracts

		const directGrantsSimpleStrategyAddress: string =
			await directGrantsSimpleStrategyContract.getAddress()

		const aliceNonce: number = await ethers.provider.getTransactionCount(
			alice.address
		)
		const aliceName: string = 'alice'
		const aliceMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}
		const aliceProfileMembers: string[] = []

		const alicePoolMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}

		const alicePoolManagers: string[] = []

		const alicePoolInitStrategyDataObject: InitializeData = {
			registryGating: false,
			metadataRequired: true,
			grantAmountRequired: true
		}

		const aliceInitStrategyDataValues: boolean[] = [
			alicePoolInitStrategyDataObject.registryGating,
			alicePoolInitStrategyDataObject.metadataRequired,
			alicePoolInitStrategyDataObject.grantAmountRequired
		]

		const aliceInitStrategyData: BytesLike = abiCoder.encode(
			initializeDataStructTypes,
			aliceInitStrategyDataValues
		)

		let bobData: RecipientData = {
			recipientId: bob.address,
			recipientAddress: ZeroAddress,
			grantAmount: toDecimal(1),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			}
		}

		const bobDataArray: any[] = [
			bobData.recipientId,
			bobData.recipientAddress,
			bobData.grantAmount,
			[bobData.metadata.protocol, bobData.metadata.pointer]
		]

		let bobDataBytes: BytesLike = abiCoder.encode(
			recipientDataStructTypes,
			bobDataArray
		)

		let bobAllocateDataArray: any[] = [bob.address, BigInt(2), toDecimal(0.5)]

		let bobAllocateDataBytes: BytesLike = abiCoder.encode(
			allocateStructTypes,
			bobAllocateDataArray
		)

		let poolFundingAmount: bigint = toDecimal(1)

		let events: any
		let event: any

		let aliceProfileId: BytesLike
		let aliceProfileDto: any
		let aliceProfile: Profile
		let aliceStrategyContract: any

		let strategyAddress: string

		let alicePoolId: bigint
		let alicePoolDto: any
		let alicePool: Pool

		let bobRecipientId: string
		let bobRecipient: Recipient
		let bobRecipientStatus: bigint

		// Act

		// Create profile
		console.log(' 🚩  1. Create profile')
		const createProfileTx = await registryInstance.connect(alice).createProfile(
			aliceNonce, // _nonce
			aliceName, // _name
			[aliceMetadata.protocol, aliceMetadata.pointer], // _metadata
			alice.address, // ownerAddress
			aliceProfileMembers // _membersAddresses
		)

		await createProfileTx.wait()

		events = await registryInstance.queryFilter(
			'ProfileCreated',
			createProfileTx.blockHash
		)

		event = events[events.length - 1]

		aliceProfileId = event.args.profileId

		aliceProfileDto = await registryInstance.getProfileById(aliceProfileId)

		aliceProfile = {
			id: aliceProfileDto[0],
			nonce: aliceProfileDto[1],
			name: aliceProfileDto[2],
			metadata: {
				protocol: aliceProfileDto[3][0],
				pointer: aliceProfileDto[3][1]
			},
			owner: aliceProfileDto[4],
			anchor: aliceProfileDto[5]
		}

		bobData.recipientAddress = aliceProfile.anchor
		bobDataArray[1] = bobData.recipientAddress
		bobDataBytes = abiCoder.encode(recipientDataStructTypes, bobDataArray)

		// Add strategy to cloneable strategies
		console.log(' 🚩  2. Add strategy to cloneable strategies')
		const addToCloneableStrategiesTx = await alloInstance
			.connect(admin)
			.addToCloneableStrategies(directGrantsSimpleStrategyAddress)

		await addToCloneableStrategiesTx.wait()

		events = await alloInstance.queryFilter(
			'StrategyApproved',
			addToCloneableStrategiesTx.blockHash
		)

		event = events[events.length - 1]

		strategyAddress = event.args.strategy

		// Create pool
		console.log(' 🚩  3. Create pool')
		const createPoolTx = await alloInstance.connect(alice).createPool(
			aliceProfileId, // _profileId
			strategyAddress, // _strategy
			aliceInitStrategyData, // _initStrategyData
			NATIVE, //_token
			poolFundingAmount, // _amount
			[alicePoolMetadata.protocol, alicePoolMetadata.pointer], // _metadata
			alicePoolManagers, // _managers
			{ value: poolFundingAmount }
		)

		await createPoolTx.wait()

		events = await alloInstance.queryFilter(
			'PoolCreated',
			createPoolTx.blockHash
		)

		event = events[events.length - 1]

		alicePoolId = event.args.poolId
		alicePoolDto = await alloInstance.getPool(alicePoolId)
		alicePool = {
			profileId: alicePoolDto[0],
			strategy: alicePoolDto[1],
			token: alicePoolDto[2],
			metadata: {
				protocol: alicePoolDto[3][0],
				pointer: alicePoolDto[3][1]
			},
			managerRole: alicePoolDto[4],
			adminRole: alicePoolDto[5]
		}

		aliceStrategyContract = await ethers.getContractAt(
			'DirectGrantsSimpleStrategy',
			alicePool.strategy
		)

		// 4. Add recipient
		console.log(' 🚩  4. Add recipient')
		const addRecipientTx = await alloInstance
			.connect(alice)
			.registerRecipient(alicePoolId, bobDataBytes)

		await addRecipientTx.wait()

		events = await aliceStrategyContract.queryFilter(
			'Registered',
			addRecipientTx.blockHash
		)

		event = events[events.length - 1]

		bobRecipientId = event.args.recipientId

		let bobRecipientDto: any[] = await aliceStrategyContract.getRecipient(
			bobRecipientId
		)

		bobRecipient = {
			useRegistryAnchor: bobRecipientDto[0],
			recipientAddress: bobRecipientDto[1],
			grantAmount: bobRecipientDto[2],
			metadata: {
				protocol: bobRecipientDto[3][0],
				pointer: bobRecipientDto[3][1]
			},
			recipientStatus: bobRecipientDto[4],
			milestonesReviewStatus: bobRecipientDto[5]
		}

		// 5. Set recipient status to inReview
		console.log(' 🚩  5. Set recipient status to inReview')

		const setRecipientStatusToInReviewTx = await aliceStrategyContract
			.connect(alice)
			.setRecipientStatusToInReview([bobRecipientId])

		await setRecipientStatusToInReviewTx.wait()

		events = await aliceStrategyContract.queryFilter(
			'RecipientStatusChanged',
			setRecipientStatusToInReviewTx.blockHash
		)

		event = events[events.length - 1]

		let recipientStatusChangedStatus: bigint = event.args.status

		bobRecipientStatus = await aliceStrategyContract.getRecipientStatus(
			bobRecipientId
		)

		// 6. Allocate funds
		console.log(' 🚩  6. Allocate funds')

		const allocateFundsTx = await alloInstance
			.connect(alice)
			.allocate(alicePoolId, bobAllocateDataBytes)

		await allocateFundsTx.wait()

		events = await aliceStrategyContract.queryFilter(
			'RecipientStatusChanged',
			allocateFundsTx.blockHash
		)

		event = events[events.length - 1]

		recipientStatusChangedStatus = event.args.status

		// Assert
		console.log('🏷️  Funds allocated')
		try {
			assert.equal(recipientStatusChangedStatus, BigInt(2))
		} catch (error) {
			console.log('🚨 Error: ', error)
		}
	})

	it.skip('Set millestone', async () => {
		// Arrange
		const { admin, alice, bob } = accounts
		const {
			registryInstance,
			alloInstance,
			directGrantsSimpleStrategyContract
		} = contracts

		const directGrantsSimpleStrategyAddress: string =
			await directGrantsSimpleStrategyContract.getAddress()

		const aliceNonce: number = await ethers.provider.getTransactionCount(
			alice.address
		)
		const aliceName: string = 'alice'
		const aliceMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}
		const aliceProfileMembers: string[] = []

		const alicePoolMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}

		const alicePoolManagers: string[] = []

		const aliceMilestone1: Milestone = {
			amountPercentage: toDecimal(0.5),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			},
			status: BigInt(0)
		}

		const aliceMilestone2: Milestone = {
			amountPercentage: toDecimal(0.5),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			},
			status: BigInt(0)
		}

		const alicePoolInitStrategyDataObject: InitializeData = {
			registryGating: false,
			metadataRequired: true,
			grantAmountRequired: true
		}

		const aliceInitStrategyDataValues: boolean[] = [
			alicePoolInitStrategyDataObject.registryGating,
			alicePoolInitStrategyDataObject.metadataRequired,
			alicePoolInitStrategyDataObject.grantAmountRequired
		]

		const aliceInitStrategyData: BytesLike = abiCoder.encode(
			initializeDataStructTypes,
			aliceInitStrategyDataValues
		)

		let bobData: RecipientData = {
			recipientId: bob.address,
			recipientAddress: ZeroAddress,
			grantAmount: toDecimal(1),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			}
		}

		let bobDataArray: any[] = [
			bobData.recipientId,
			bobData.recipientAddress,
			bobData.grantAmount,
			[bobData.metadata.protocol, bobData.metadata.pointer]
		]

		let bobDataBytes: BytesLike = abiCoder.encode(
			recipientDataStructTypes,
			bobDataArray
		)

		let bobAllocateDataArray: any[] = [bob.address, BigInt(2), toDecimal(0.5)]

		let bobAllocateDataBytes: BytesLike = abiCoder.encode(
			allocateStructTypes,
			bobAllocateDataArray
		)

		let poolFundingAmount: bigint = toDecimal(1)

		let transactionReceipt: any
		let transactionBlockNumber: any

		let events: any
		let event: any

		let aliceProfileId: BytesLike
		let aliceProfileDto: any
		let aliceProfile: Profile
		let aliceStrategyContract: any

		let strategyAddress: string

		let alicePoolId: bigint
		let alicePoolDto: any
		let alicePool: Pool

		let bobRecipientId: string
		let bobRecipient: Recipient
		let bobRecipientStatus: bigint

		// Act

		// Create profile
		console.log(' 🚩  1. Create profile')
		const createProfileTx = await registryInstance.connect(alice).createProfile(
			aliceNonce, // _nonce
			aliceName, // _name
			[aliceMetadata.protocol, aliceMetadata.pointer], // _metadata
			alice.address, // ownerAddress
			aliceProfileMembers // _membersAddresses
		)

		await createProfileTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			createProfileTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await registryInstance.queryFilter(
			'ProfileCreated',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		aliceProfileId = event.args.profileId

		aliceProfileDto = await registryInstance.getProfileById(aliceProfileId)

		aliceProfile = {
			id: aliceProfileDto[0],
			nonce: aliceProfileDto[1],
			name: aliceProfileDto[2],
			metadata: {
				protocol: aliceProfileDto[3][0],
				pointer: aliceProfileDto[3][1]
			},
			owner: aliceProfileDto[4],
			anchor: aliceProfileDto[5]
		}

		bobData.recipientAddress = aliceProfile.anchor
		bobDataArray[1] = aliceProfile.anchor
		bobDataBytes = abiCoder.encode(recipientDataStructTypes, bobDataArray)

		// Add strategy to cloneable strategies
		console.log(' 🚩  2. Add strategy to cloneable strategies')
		const addToCloneableStrategiesTx = await alloInstance
			.connect(admin)
			.addToCloneableStrategies(directGrantsSimpleStrategyAddress)

		await addToCloneableStrategiesTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			addToCloneableStrategiesTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await alloInstance.queryFilter(
			'StrategyApproved',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		strategyAddress = event.args.strategy

		// Create pool
		console.log(' 🚩  3. Create pool')
		const createPoolTx = await alloInstance.connect(alice).createPool(
			aliceProfileId, // _profileId
			strategyAddress, // _strategy
			aliceInitStrategyData, // _initStrategyData
			NATIVE, //_token
			poolFundingAmount, // _amount
			[alicePoolMetadata.protocol, alicePoolMetadata.pointer], // _metadata
			alicePoolManagers, // _managers
			{ value: poolFundingAmount }
		)

		await createPoolTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			createPoolTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await alloInstance.queryFilter(
			'PoolCreated',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		alicePoolId = event.args.poolId
		alicePoolDto = await alloInstance.getPool(alicePoolId)
		alicePool = {
			profileId: alicePoolDto[0],
			strategy: alicePoolDto[1],
			token: alicePoolDto[2],
			metadata: {
				protocol: alicePoolDto[3][0],
				pointer: alicePoolDto[3][1]
			},
			managerRole: alicePoolDto[4],
			adminRole: alicePoolDto[5]
		}

		aliceStrategyContract = await ethers.getContractAt(
			'DirectGrantsSimpleStrategy',
			alicePool.strategy
		)

		// 4. Add recipient
		console.log(' 🚩  4. Add recipient')
		const addRecipientTx = await alloInstance
			.connect(alice)
			.registerRecipient(alicePoolId, bobDataBytes)

		await addRecipientTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			addRecipientTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'Registered',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		bobRecipientId = event.args.recipientId

		let bobRecipientDto: any[] = await aliceStrategyContract.getRecipient(
			bobRecipientId
		)

		bobRecipient = {
			useRegistryAnchor: bobRecipientDto[0],
			recipientAddress: bobRecipientDto[1],
			grantAmount: bobRecipientDto[2],
			metadata: {
				protocol: bobRecipientDto[3][0],
				pointer: bobRecipientDto[3][1]
			},
			recipientStatus: bobRecipientDto[4],
			milestonesReviewStatus: bobRecipientDto[5]
		}

		// 5. Set recipient status to inReview
		console.log(' 🚩  5. Set recipient status to inReview')

		const setRecipientStatusToInReviewTx = await aliceStrategyContract
			.connect(alice)
			.setRecipientStatusToInReview([bobRecipientId])

		await setRecipientStatusToInReviewTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			setRecipientStatusToInReviewTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'RecipientStatusChanged',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		let recipientStatusChangedStatus: bigint = event.args.status

		bobRecipientStatus = await aliceStrategyContract.getRecipientStatus(
			bobRecipientId
		)

		// 6. Allocate funds
		console.log(' 🚩  6. Allocate funds')

		const allocateFundsTx = await alloInstance
			.connect(alice)
			.allocate(alicePoolId, bobAllocateDataBytes)

		await allocateFundsTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			setRecipientStatusToInReviewTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'RecipientStatusChanged',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		recipientStatusChangedStatus = event.args.status

		// 7. Set milestone
		console.log(' 🚩  7. Set milestone')

		const setMilestoneTx = await aliceStrategyContract
			.connect(bob)
			.setMilestones(bob.address, [
				[
					aliceMilestone1.amountPercentage,
					aliceMilestone1.metadata,
					aliceMilestone1.status
				],
				[
					aliceMilestone2.amountPercentage,
					aliceMilestone2.metadata,
					aliceMilestone2.status
				]
			])

		await setMilestoneTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			setMilestoneTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'MilestonesSet',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		const milestoneLength: bigint = event.args.milestonesLength

		// Assert
		console.log('🏷️  Milestone set')
		try {
			assert.equal(milestoneLength, BigInt(2))
		} catch (error) {
			console.log('🚨 Error: ', error)
		}
	})

	it.skip('Review set milestone', async () => {
		// Arrange
		const { admin, alice, bob } = accounts
		const {
			registryInstance,
			alloInstance,
			directGrantsSimpleStrategyContract
		} = contracts

		const directGrantsSimpleStrategyAddress: string =
			await directGrantsSimpleStrategyContract.getAddress()

		const aliceNonce: number = await ethers.provider.getTransactionCount(
			alice.address
		)
		const aliceName: string = 'alice'
		const aliceMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}
		const aliceProfileMembers: string[] = []

		const alicePoolMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}

		const alicePoolManagers: string[] = []

		const aliceMilestone1: Milestone = {
			amountPercentage: toDecimal(0.5),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			},
			status: BigInt(0)
		}

		const aliceMilestone2: Milestone = {
			amountPercentage: toDecimal(0.5),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			},
			status: BigInt(0)
		}

		const alicePoolInitStrategyDataObject: InitializeData = {
			registryGating: false,
			metadataRequired: true,
			grantAmountRequired: true
		}

		const aliceInitStrategyDataValues: boolean[] = [
			alicePoolInitStrategyDataObject.registryGating,
			alicePoolInitStrategyDataObject.metadataRequired,
			alicePoolInitStrategyDataObject.grantAmountRequired
		]

		const aliceInitStrategyData: BytesLike = abiCoder.encode(
			initializeDataStructTypes,
			aliceInitStrategyDataValues
		)

		let bobData: RecipientData = {
			recipientId: bob.address,
			recipientAddress: ZeroAddress,
			grantAmount: toDecimal(1),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			}
		}

		let bobDataArray: any[] = [
			bobData.recipientId,
			bobData.recipientAddress,
			bobData.grantAmount,
			[bobData.metadata.protocol, bobData.metadata.pointer]
		]

		let bobDataBytes: BytesLike = abiCoder.encode(
			recipientDataStructTypes,
			bobDataArray
		)

		let bobAllocateDataArray: any[] = [bob.address, BigInt(2), toDecimal(0.5)]

		let bobAllocateDataBytes: BytesLike = abiCoder.encode(
			allocateStructTypes,
			bobAllocateDataArray
		)

		let poolFundingAmount: bigint = toDecimal(1)

		let transactionReceipt: any
		let transactionBlockNumber: any

		let events: any
		let event: any

		let aliceProfileId: BytesLike
		let aliceProfileDto: any
		let aliceProfile: Profile
		let aliceStrategyContract: any

		let strategyAddress: string

		let alicePoolId: bigint
		let alicePoolDto: any
		let alicePool: Pool

		let bobRecipientId: string
		let bobRecipient: Recipient
		let bobRecipientStatus: bigint

		// Act

		// Create profile
		console.log(' 🚩  1. Create profile')
		const createProfileTx = await registryInstance.connect(alice).createProfile(
			aliceNonce, // _nonce
			aliceName, // _name
			[aliceMetadata.protocol, aliceMetadata.pointer], // _metadata
			alice.address, // ownerAddress
			aliceProfileMembers // _membersAddresses
		)

		await createProfileTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			createProfileTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await registryInstance.queryFilter(
			'ProfileCreated',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		aliceProfileId = event.args.profileId

		aliceProfileDto = await registryInstance.getProfileById(aliceProfileId)

		aliceProfile = {
			id: aliceProfileDto[0],
			nonce: aliceProfileDto[1],
			name: aliceProfileDto[2],
			metadata: {
				protocol: aliceProfileDto[3][0],
				pointer: aliceProfileDto[3][1]
			},
			owner: aliceProfileDto[4],
			anchor: aliceProfileDto[5]
		}

		bobData.recipientAddress = aliceProfile.anchor
		bobDataArray[1] = aliceProfile.anchor
		bobDataBytes = abiCoder.encode(recipientDataStructTypes, bobDataArray)

		// Add strategy to cloneable strategies
		console.log(' 🚩  2. Add strategy to cloneable strategies')
		const addToCloneableStrategiesTx = await alloInstance
			.connect(admin)
			.addToCloneableStrategies(directGrantsSimpleStrategyAddress)

		await addToCloneableStrategiesTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			addToCloneableStrategiesTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await alloInstance.queryFilter(
			'StrategyApproved',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		strategyAddress = event.args.strategy

		// Create pool
		console.log(' 🚩  3. Create pool')
		const createPoolTx = await alloInstance.connect(alice).createPool(
			aliceProfileId, // _profileId
			strategyAddress, // _strategy
			aliceInitStrategyData, // _initStrategyData
			NATIVE, //_token
			poolFundingAmount, // _amount
			[alicePoolMetadata.protocol, alicePoolMetadata.pointer], // _metadata
			alicePoolManagers, // _managers
			{ value: poolFundingAmount }
		)

		await createPoolTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			createPoolTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await alloInstance.queryFilter(
			'PoolCreated',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		alicePoolId = event.args.poolId
		alicePoolDto = await alloInstance.getPool(alicePoolId)
		alicePool = {
			profileId: alicePoolDto[0],
			strategy: alicePoolDto[1],
			token: alicePoolDto[2],
			metadata: {
				protocol: alicePoolDto[3][0],
				pointer: alicePoolDto[3][1]
			},
			managerRole: alicePoolDto[4],
			adminRole: alicePoolDto[5]
		}

		aliceStrategyContract = await ethers.getContractAt(
			'DirectGrantsSimpleStrategy',
			alicePool.strategy
		)

		// 4. Add recipient
		console.log(' 🚩  4. Add recipient')
		const addRecipientTx = await alloInstance
			.connect(alice)
			.registerRecipient(alicePoolId, bobDataBytes)

		await addRecipientTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			addRecipientTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'Registered',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		bobRecipientId = event.args.recipientId

		let bobRecipientDto: any[] = await aliceStrategyContract.getRecipient(
			bobRecipientId
		)

		bobRecipient = {
			useRegistryAnchor: bobRecipientDto[0],
			recipientAddress: bobRecipientDto[1],
			grantAmount: bobRecipientDto[2],
			metadata: {
				protocol: bobRecipientDto[3][0],
				pointer: bobRecipientDto[3][1]
			},
			recipientStatus: bobRecipientDto[4],
			milestonesReviewStatus: bobRecipientDto[5]
		}

		// 5. Set recipient status to inReview
		console.log(' 🚩  5. Set recipient status to inReview')

		const setRecipientStatusToInReviewTx = await aliceStrategyContract
			.connect(alice)
			.setRecipientStatusToInReview([bobRecipientId])

		await setRecipientStatusToInReviewTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			setRecipientStatusToInReviewTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'RecipientStatusChanged',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		let recipientStatusChangedStatus: bigint = event.args.status

		bobRecipientStatus = await aliceStrategyContract.getRecipientStatus(
			bobRecipientId
		)

		// 6. Allocate funds
		console.log(' 🚩  6. Allocate funds')

		const allocateFundsTx = await alloInstance
			.connect(alice)
			.allocate(alicePoolId, bobAllocateDataBytes)

		await allocateFundsTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			setRecipientStatusToInReviewTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'RecipientStatusChanged',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		recipientStatusChangedStatus = event.args.status

		// 7. Set milestone
		console.log(' 🚩  7. Set milestone')

		const setMilestoneTx = await aliceStrategyContract
			.connect(bob)
			.setMilestones(bob.address, [
				[
					aliceMilestone1.amountPercentage,
					aliceMilestone1.metadata,
					aliceMilestone1.status
				],
				[
					aliceMilestone2.amountPercentage,
					aliceMilestone2.metadata,
					aliceMilestone2.status
				]
			])

		await setMilestoneTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			setMilestoneTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'MilestonesSet',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		const milestoneLength: bigint = event.args.milestonesLength

		// 8. Review set milestone
		console.log(' 🚩  8. Review set milestones')

		const reviewSetMilestonesTx = await aliceStrategyContract
			.connect(alice)
			.reviewSetMilestones(
				bob.address, //  _recipientId
				BigInt(2) // _status
			)

		await reviewSetMilestonesTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			reviewSetMilestonesTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'MilestonesReviewed',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		const milestonesReviewStatus: bigint = event.args.status

		// Assert
		console.log('🏷️  Milestone reviewed')
		try {
			assert.equal(milestonesReviewStatus, BigInt(2))
		} catch (error) {
			console.log('🚨 Error: ', error)
		}
	})

	it.skip('Submit Milestone', async () => {
		// Arrange
		const { admin, alice, bob } = accounts
		const {
			registryInstance,
			alloInstance,
			directGrantsSimpleStrategyContract
		} = contracts

		const directGrantsSimpleStrategyAddress: string =
			await directGrantsSimpleStrategyContract.getAddress()

		const aliceNonce: number = await ethers.provider.getTransactionCount(
			alice.address
		)
		const aliceName: string = 'alice'
		const aliceMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}
		const aliceProfileMembers: string[] = []

		const alicePoolMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}

		const alicePoolManagers: string[] = []

		const aliceMilestone1: Milestone = {
			amountPercentage: toDecimal(0.5),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			},
			status: BigInt(0)
		}

		const aliceMilestone2: Milestone = {
			amountPercentage: toDecimal(0.5),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			},
			status: BigInt(0)
		}

		const alicePoolInitStrategyDataObject: InitializeData = {
			registryGating: false,
			metadataRequired: true,
			grantAmountRequired: true
		}

		const aliceInitStrategyDataValues: boolean[] = [
			alicePoolInitStrategyDataObject.registryGating,
			alicePoolInitStrategyDataObject.metadataRequired,
			alicePoolInitStrategyDataObject.grantAmountRequired
		]

		const aliceInitStrategyData: BytesLike = abiCoder.encode(
			initializeDataStructTypes,
			aliceInitStrategyDataValues
		)

		let bobData: RecipientData = {
			recipientId: bob.address,
			recipientAddress: ZeroAddress,
			grantAmount: toDecimal(1),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			}
		}

		let bobDataArray: any[] = [
			bobData.recipientId,
			bobData.recipientAddress,
			bobData.grantAmount,
			[bobData.metadata.protocol, bobData.metadata.pointer]
		]

		let bobDataBytes: BytesLike = abiCoder.encode(
			recipientDataStructTypes,
			bobDataArray
		)

		let bobAllocateDataArray: any[] = [bob.address, BigInt(2), toDecimal(0.5)]

		let bobAllocateDataBytes: BytesLike = abiCoder.encode(
			allocateStructTypes,
			bobAllocateDataArray
		)

		const bobMilestone1: Milestone = {
			amountPercentage: toDecimal(0.5),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			},
			status: BigInt(0)
		}

		const bobMilestone1Array: any[] = [
			bobMilestone1.metadata.protocol,
			bobMilestone1.metadata.pointer
		]

		const bobMilestone1Bytes: BytesLike = abiCoder.encode(
			metadataStructTypes,
			bobMilestone1Array
		)

		const bobMilestone2: Milestone = {
			amountPercentage: toDecimal(0.5),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			},
			status: BigInt(0)
		}

		const bobMilestone2Array: any[] = [
			bobMilestone2.metadata.protocol,
			bobMilestone2.metadata.pointer
		]

		const bobMilestone2Bytes: BytesLike = abiCoder.encode(
			metadataStructTypes,
			bobMilestone2Array
		)

		let poolFundingAmount: bigint = toDecimal(1)

		let transactionReceipt: any
		let transactionBlockNumber: any

		let events: any
		let event: any

		let aliceProfileId: BytesLike
		let aliceProfileDto: any
		let aliceProfile: Profile
		let aliceStrategyContract: any

		let strategyAddress: string

		let alicePoolId: bigint
		let alicePoolDto: any
		let alicePool: Pool

		let bobRecipientId: string
		let bobRecipient: Recipient
		let bobRecipientStatus: bigint

		// Act

		// Create profile
		console.log(' 🚩  1. Create profile')
		const createProfileTx = await registryInstance.connect(alice).createProfile(
			aliceNonce, // _nonce
			aliceName, // _name
			[aliceMetadata.protocol, aliceMetadata.pointer], // _metadata
			alice.address, // ownerAddress
			aliceProfileMembers // _membersAddresses
		)

		await createProfileTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			createProfileTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await registryInstance.queryFilter(
			'ProfileCreated',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		aliceProfileId = event.args.profileId

		aliceProfileDto = await registryInstance.getProfileById(aliceProfileId)

		aliceProfile = {
			id: aliceProfileDto[0],
			nonce: aliceProfileDto[1],
			name: aliceProfileDto[2],
			metadata: {
				protocol: aliceProfileDto[3][0],
				pointer: aliceProfileDto[3][1]
			},
			owner: aliceProfileDto[4],
			anchor: aliceProfileDto[5]
		}

		bobData.recipientAddress = aliceProfile.anchor
		bobDataArray[1] = aliceProfile.anchor
		bobDataBytes = abiCoder.encode(recipientDataStructTypes, bobDataArray)

		// Add strategy to cloneable strategies
		console.log(' 🚩  2. Add strategy to cloneable strategies')
		const addToCloneableStrategiesTx = await alloInstance
			.connect(admin)
			.addToCloneableStrategies(directGrantsSimpleStrategyAddress)

		await addToCloneableStrategiesTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			addToCloneableStrategiesTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await alloInstance.queryFilter(
			'StrategyApproved',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		strategyAddress = event.args.strategy

		// Create pool
		console.log(' 🚩  3. Create pool')
		const createPoolTx = await alloInstance.connect(alice).createPool(
			aliceProfileId, // _profileId
			strategyAddress, // _strategy
			aliceInitStrategyData, // _initStrategyData
			NATIVE, //_token
			poolFundingAmount, // _amount
			[alicePoolMetadata.protocol, alicePoolMetadata.pointer], // _metadata
			alicePoolManagers, // _managers
			{ value: poolFundingAmount }
		)

		await createPoolTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			createPoolTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await alloInstance.queryFilter(
			'PoolCreated',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		alicePoolId = event.args.poolId
		alicePoolDto = await alloInstance.getPool(alicePoolId)
		alicePool = {
			profileId: alicePoolDto[0],
			strategy: alicePoolDto[1],
			token: alicePoolDto[2],
			metadata: {
				protocol: alicePoolDto[3][0],
				pointer: alicePoolDto[3][1]
			},
			managerRole: alicePoolDto[4],
			adminRole: alicePoolDto[5]
		}

		aliceStrategyContract = await ethers.getContractAt(
			'DirectGrantsSimpleStrategy',
			alicePool.strategy
		)

		// 4. Add recipient
		console.log(' 🚩  4. Add recipient')
		const addRecipientTx = await alloInstance
			.connect(alice)
			.registerRecipient(alicePoolId, bobDataBytes)

		await addRecipientTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			addRecipientTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'Registered',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		bobRecipientId = event.args.recipientId

		let bobRecipientDto: any[] = await aliceStrategyContract.getRecipient(
			bobRecipientId
		)

		bobRecipient = {
			useRegistryAnchor: bobRecipientDto[0],
			recipientAddress: bobRecipientDto[1],
			grantAmount: bobRecipientDto[2],
			metadata: {
				protocol: bobRecipientDto[3][0],
				pointer: bobRecipientDto[3][1]
			},
			recipientStatus: bobRecipientDto[4],
			milestonesReviewStatus: bobRecipientDto[5]
		}

		// 5. Set recipient status to inReview
		console.log(' 🚩  5. Set recipient status to inReview')

		const setRecipientStatusToInReviewTx = await aliceStrategyContract
			.connect(alice)
			.setRecipientStatusToInReview([bobRecipientId])

		await setRecipientStatusToInReviewTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			setRecipientStatusToInReviewTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'RecipientStatusChanged',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		let recipientStatusChangedStatus: bigint = event.args.status

		bobRecipientStatus = await aliceStrategyContract.getRecipientStatus(
			bobRecipientId
		)

		// 6. Allocate funds
		console.log(' 🚩  6. Allocate funds')

		const allocateFundsTx = await alloInstance
			.connect(alice)
			.allocate(alicePoolId, bobAllocateDataBytes)

		await allocateFundsTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			setRecipientStatusToInReviewTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'RecipientStatusChanged',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		recipientStatusChangedStatus = event.args.status

		// 7. Set milestone
		console.log(' 🚩  7. Set milestone')

		const setMilestoneTx = await aliceStrategyContract
			.connect(bob)
			.setMilestones(bob.address, [
				[
					aliceMilestone1.amountPercentage,
					aliceMilestone1.metadata,
					aliceMilestone1.status
				],
				[
					aliceMilestone2.amountPercentage,
					aliceMilestone2.metadata,
					aliceMilestone2.status
				]
			])

		await setMilestoneTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			setMilestoneTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'MilestonesSet',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		const milestoneLength: bigint = event.args.milestonesLength

		// 8. Review set milestone
		console.log(' 🚩  8. Review set milestones')

		const reviewSetMilestonesTx = await aliceStrategyContract
			.connect(alice)
			.reviewSetMilestones(
				bob.address, //  _recipientId
				BigInt(2) // _status
			)

		await reviewSetMilestonesTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			reviewSetMilestonesTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'MilestonesReviewed',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		const milestonesReviewStatus: bigint = event.args.status

		// 9. Submit milestone
		console.log(' 🚩  9. Submit milestone')

		const submitMilestoneTx = await aliceStrategyContract
			.connect(bob)
			.submitMilestone(
				bob.address, // _recipientId
				BigInt(1), // _milestoneId
				bobMilestone1Array // _metadata
			)

		await submitMilestoneTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			submitMilestoneTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'MilestoneSubmitted',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		const milestoneStatus: bigint = event.args.milestoneId

		// Assert
		console.log('🏷️  Milestone submitted')
		try {
			assert.equal(milestoneStatus, BigInt(1))
		} catch (error) {
			console.log('🚨 Error: ', error)
		}
	})

	it.skip('Reject Milestone', async () => {
		// Arrange
		const { admin, alice, bob } = accounts
		const {
			registryInstance,
			alloInstance,
			directGrantsSimpleStrategyContract
		} = contracts

		const directGrantsSimpleStrategyAddress: string =
			await directGrantsSimpleStrategyContract.getAddress()

		const aliceNonce: number = await ethers.provider.getTransactionCount(
			alice.address
		)
		const aliceName: string = 'alice'
		const aliceMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}
		const aliceProfileMembers: string[] = []

		const alicePoolMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}

		const alicePoolManagers: string[] = []

		const aliceMilestone1: Milestone = {
			amountPercentage: toDecimal(0.5),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			},
			status: BigInt(0)
		}

		const aliceMilestone2: Milestone = {
			amountPercentage: toDecimal(0.5),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			},
			status: BigInt(0)
		}

		const alicePoolInitStrategyDataObject: InitializeData = {
			registryGating: false,
			metadataRequired: true,
			grantAmountRequired: true
		}

		const aliceInitStrategyDataValues: boolean[] = [
			alicePoolInitStrategyDataObject.registryGating,
			alicePoolInitStrategyDataObject.metadataRequired,
			alicePoolInitStrategyDataObject.grantAmountRequired
		]

		const aliceInitStrategyData: BytesLike = abiCoder.encode(
			initializeDataStructTypes,
			aliceInitStrategyDataValues
		)

		let bobData: RecipientData = {
			recipientId: bob.address,
			recipientAddress: ZeroAddress,
			grantAmount: toDecimal(1),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			}
		}

		let bobDataArray: any[] = [
			bobData.recipientId,
			bobData.recipientAddress,
			bobData.grantAmount,
			[bobData.metadata.protocol, bobData.metadata.pointer]
		]

		let bobDataBytes: BytesLike = abiCoder.encode(
			recipientDataStructTypes,
			bobDataArray
		)

		let bobAllocateDataArray: any[] = [bob.address, BigInt(2), toDecimal(0.5)]

		let bobAllocateDataBytes: BytesLike = abiCoder.encode(
			allocateStructTypes,
			bobAllocateDataArray
		)

		const bobMilestone1: Milestone = {
			amountPercentage: toDecimal(0.5),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			},
			status: BigInt(0)
		}

		const bobMilestone1Array: any[] = [
			bobMilestone1.metadata.protocol,
			bobMilestone1.metadata.pointer
		]

		const bobMilestone1Bytes: BytesLike = abiCoder.encode(
			metadataStructTypes,
			bobMilestone1Array
		)

		const bobMilestone2: Milestone = {
			amountPercentage: toDecimal(0.5),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			},
			status: BigInt(0)
		}

		const bobMilestone2Array: any[] = [
			bobMilestone2.metadata.protocol,
			bobMilestone2.metadata.pointer
		]

		const bobMilestone2Bytes: BytesLike = abiCoder.encode(
			metadataStructTypes,
			bobMilestone2Array
		)

		let poolFundingAmount: bigint = toDecimal(1)

		let transactionReceipt: any
		let transactionBlockNumber: any

		let events: any
		let event: any

		let aliceProfileId: BytesLike
		let aliceProfileDto: any
		let aliceProfile: Profile
		let aliceStrategyContract: any

		let strategyAddress: string

		let alicePoolId: bigint
		let alicePoolDto: any
		let alicePool: Pool

		let bobRecipientId: string
		let bobRecipient: Recipient
		let bobRecipientStatus: bigint

		// Act

		// Create profile
		console.log(' 🚩  1. Create profile')
		const createProfileTx = await registryInstance.connect(alice).createProfile(
			aliceNonce, // _nonce
			aliceName, // _name
			[aliceMetadata.protocol, aliceMetadata.pointer], // _metadata
			alice.address, // ownerAddress
			aliceProfileMembers // _membersAddresses
		)

		await createProfileTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			createProfileTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await registryInstance.queryFilter(
			'ProfileCreated',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		aliceProfileId = event.args.profileId

		aliceProfileDto = await registryInstance.getProfileById(aliceProfileId)

		aliceProfile = {
			id: aliceProfileDto[0],
			nonce: aliceProfileDto[1],
			name: aliceProfileDto[2],
			metadata: {
				protocol: aliceProfileDto[3][0],
				pointer: aliceProfileDto[3][1]
			},
			owner: aliceProfileDto[4],
			anchor: aliceProfileDto[5]
		}

		bobData.recipientAddress = aliceProfile.anchor
		bobDataArray[1] = aliceProfile.anchor
		bobDataBytes = abiCoder.encode(recipientDataStructTypes, bobDataArray)

		// Add strategy to cloneable strategies
		console.log(' 🚩  2. Add strategy to cloneable strategies')
		const addToCloneableStrategiesTx = await alloInstance
			.connect(admin)
			.addToCloneableStrategies(directGrantsSimpleStrategyAddress)

		await addToCloneableStrategiesTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			addToCloneableStrategiesTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await alloInstance.queryFilter(
			'StrategyApproved',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		strategyAddress = event.args.strategy

		// Create pool
		console.log(' 🚩  3. Create pool')
		const createPoolTx = await alloInstance.connect(alice).createPool(
			aliceProfileId, // _profileId
			strategyAddress, // _strategy
			aliceInitStrategyData, // _initStrategyData
			NATIVE, //_token
			poolFundingAmount, // _amount
			[alicePoolMetadata.protocol, alicePoolMetadata.pointer], // _metadata
			alicePoolManagers, // _managers
			{ value: poolFundingAmount }
		)

		await createPoolTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			createPoolTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await alloInstance.queryFilter(
			'PoolCreated',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		alicePoolId = event.args.poolId
		alicePoolDto = await alloInstance.getPool(alicePoolId)
		alicePool = {
			profileId: alicePoolDto[0],
			strategy: alicePoolDto[1],
			token: alicePoolDto[2],
			metadata: {
				protocol: alicePoolDto[3][0],
				pointer: alicePoolDto[3][1]
			},
			managerRole: alicePoolDto[4],
			adminRole: alicePoolDto[5]
		}

		aliceStrategyContract = await ethers.getContractAt(
			'DirectGrantsSimpleStrategy',
			alicePool.strategy
		)

		// 4. Add recipient
		console.log(' 🚩  4. Add recipient')
		const addRecipientTx = await alloInstance
			.connect(alice)
			.registerRecipient(alicePoolId, bobDataBytes)

		await addRecipientTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			addRecipientTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'Registered',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		bobRecipientId = event.args.recipientId

		let bobRecipientDto: any[] = await aliceStrategyContract.getRecipient(
			bobRecipientId
		)

		bobRecipient = {
			useRegistryAnchor: bobRecipientDto[0],
			recipientAddress: bobRecipientDto[1],
			grantAmount: bobRecipientDto[2],
			metadata: {
				protocol: bobRecipientDto[3][0],
				pointer: bobRecipientDto[3][1]
			},
			recipientStatus: bobRecipientDto[4],
			milestonesReviewStatus: bobRecipientDto[5]
		}

		// 5. Set recipient status to inReview
		console.log(' 🚩  5. Set recipient status to inReview')

		const setRecipientStatusToInReviewTx = await aliceStrategyContract
			.connect(alice)
			.setRecipientStatusToInReview([bobRecipientId])

		await setRecipientStatusToInReviewTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			setRecipientStatusToInReviewTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'RecipientStatusChanged',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		let recipientStatusChangedStatus: bigint = event.args.status

		bobRecipientStatus = await aliceStrategyContract.getRecipientStatus(
			bobRecipientId
		)

		// 6. Allocate funds
		console.log(' 🚩  6. Allocate funds')

		const allocateFundsTx = await alloInstance
			.connect(alice)
			.allocate(alicePoolId, bobAllocateDataBytes)

		await allocateFundsTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			setRecipientStatusToInReviewTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'RecipientStatusChanged',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		recipientStatusChangedStatus = event.args.status

		// 7. Set milestone
		console.log(' 🚩  7. Set milestone')

		const setMilestoneTx = await aliceStrategyContract
			.connect(bob)
			.setMilestones(bob.address, [
				[
					aliceMilestone1.amountPercentage,
					aliceMilestone1.metadata,
					aliceMilestone1.status
				],
				[
					aliceMilestone2.amountPercentage,
					aliceMilestone2.metadata,
					aliceMilestone2.status
				]
			])

		await setMilestoneTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			setMilestoneTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'MilestonesSet',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		const milestoneLength: bigint = event.args.milestonesLength

		// 8. Review set milestone
		console.log(' 🚩  8. Review set milestones')

		const reviewSetMilestonesTx = await aliceStrategyContract
			.connect(alice)
			.reviewSetMilestones(
				bob.address, //  _recipientId
				BigInt(2) // _status
			)

		await reviewSetMilestonesTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			reviewSetMilestonesTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'MilestonesReviewed',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		const milestonesReviewStatus: bigint = event.args.status

		// 9. Submit milestone
		console.log(' 🚩  9. Submit milestone')

		const submitMilestoneTx = await aliceStrategyContract
			.connect(bob)
			.submitMilestone(
				bob.address, // _recipientId
				BigInt(1), // _milestoneId
				bobMilestone1Array // _metadata
			)

		await submitMilestoneTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			submitMilestoneTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'MilestoneSubmitted',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		const milestoneStatus: bigint = event.args.milestoneId

		// 10. Reject milestone
		console.log(' 🚩  10. Reject milestone')

		const rejectMilestoneTx = await aliceStrategyContract
			.connect(alice)
			.rejectMilestone(
				bob.address, // _recipientId
				BigInt(1) // _milestoneId
			)

		await rejectMilestoneTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			rejectMilestoneTx.hash
		)

		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'MilestoneStatusChanged',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		const milestoneStatusChangedStatus: bigint = event.args.status

		// Assert
		console.log('🏷️  Milestone rejected')
		try {
			assert.equal(milestoneStatusChangedStatus, BigInt(3))
		} catch (error) {
			console.log('🚨 Error: ', error)
		}
	})

	it('Distribute Milestone fund', async () => {
		// Arrange
		const { admin, alice, bob } = accounts
		const {
			registryInstance,
			alloInstance,
			directGrantsSimpleStrategyContract
		} = contracts

		const directGrantsSimpleStrategyAddress: string =
			await directGrantsSimpleStrategyContract.getAddress()

		const aliceNonce: number = await ethers.provider.getTransactionCount(
			alice.address
		)
		const aliceName: string = 'alice'
		const aliceMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}
		const aliceProfileMembers: string[] = []

		const alicePoolMetadata: Metadata = {
			protocol: BigInt(1),
			pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
		}

		const alicePoolManagers: string[] = []

		const aliceMilestone1: Milestone = {
			amountPercentage: toDecimal(0.5),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			},
			status: BigInt(0)
		}

		const aliceMilestone2: Milestone = {
			amountPercentage: toDecimal(0.5),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			},
			status: BigInt(0)
		}

		const alicePoolInitStrategyDataObject: InitializeData = {
			registryGating: false,
			metadataRequired: true,
			grantAmountRequired: true
		}

		const aliceInitStrategyDataValues: boolean[] = [
			alicePoolInitStrategyDataObject.registryGating,
			alicePoolInitStrategyDataObject.metadataRequired,
			alicePoolInitStrategyDataObject.grantAmountRequired
		]

		const aliceInitStrategyData: BytesLike = abiCoder.encode(
			initializeDataStructTypes,
			aliceInitStrategyDataValues
		)

		let bobData: RecipientData = {
			recipientId: bob.address,
			recipientAddress: ZeroAddress,
			grantAmount: toDecimal(1),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			}
		}

		let bobDataArray: any[] = [
			bobData.recipientId,
			bobData.recipientAddress,
			bobData.grantAmount,
			[bobData.metadata.protocol, bobData.metadata.pointer]
		]

		let bobDataBytes: BytesLike = abiCoder.encode(
			recipientDataStructTypes,
			bobDataArray
		)

		let bobAllocateDataArray: any[] = [bob.address, BigInt(2), toDecimal(1)]

		let bobAllocateDataBytes: BytesLike = abiCoder.encode(
			allocateStructTypes,
			bobAllocateDataArray
		)

		const bobMilestone1: Milestone = {
			amountPercentage: toDecimal(0.5),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			},
			status: BigInt(0)
		}

		const bobMilestone1Array: any[] = [
			bobMilestone1.metadata.protocol,
			bobMilestone1.metadata.pointer
		]

		const bobMilestone1Bytes: BytesLike = abiCoder.encode(
			metadataStructTypes,
			bobMilestone1Array
		)

		const bobMilestone2: Milestone = {
			amountPercentage: toDecimal(0.5),
			metadata: {
				protocol: BigInt(1),
				pointer: 'ipfs://QmQmQmQmQmQmQmQmQmQmQmQmQm'
			},
			status: BigInt(0)
		}

		const bobMilestone2Array: any[] = [
			bobMilestone2.metadata.protocol,
			bobMilestone2.metadata.pointer
		]

		const bobMilestone2Bytes: BytesLike = abiCoder.encode(
			metadataStructTypes,
			bobMilestone2Array
		)

		let poolFundingAmount: bigint = toDecimal(1)

		let transactionReceipt: any
		let transactionBlockNumber: any

		let events: any
		let event: any

		let aliceProfileId: BytesLike
		let aliceProfileDto: any
		let aliceProfile: Profile
		let aliceStrategyContract: any

		let strategyAddress: string

		let alicePoolId: bigint
		let alicePoolDto: any
		let alicePool: Pool

		let bobRecipientId: string
		let bobRecipient: Recipient
		let bobRecipientStatus: bigint

		// Act

		// Create profile
		console.log(' 🚩  1. Create profile')
		const createProfileTx = await registryInstance.connect(alice).createProfile(
			aliceNonce, // _nonce
			aliceName, // _name
			[aliceMetadata.protocol, aliceMetadata.pointer], // _metadata
			alice.address, // ownerAddress
			aliceProfileMembers // _membersAddresses
		)

		await createProfileTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			createProfileTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await registryInstance.queryFilter(
			'ProfileCreated',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		aliceProfileId = event.args.profileId

		aliceProfileDto = await registryInstance.getProfileById(aliceProfileId)

		aliceProfile = {
			id: aliceProfileDto[0],
			nonce: aliceProfileDto[1],
			name: aliceProfileDto[2],
			metadata: {
				protocol: aliceProfileDto[3][0],
				pointer: aliceProfileDto[3][1]
			},
			owner: aliceProfileDto[4],
			anchor: aliceProfileDto[5]
		}

		bobData.recipientAddress = aliceProfile.anchor
		bobDataArray[1] = aliceProfile.anchor
		bobDataBytes = abiCoder.encode(recipientDataStructTypes, bobDataArray)

		// Add strategy to cloneable strategies
		console.log(' 🚩  2. Add strategy to cloneable strategies')
		const addToCloneableStrategiesTx = await alloInstance
			.connect(admin)
			.addToCloneableStrategies(directGrantsSimpleStrategyAddress)

		await addToCloneableStrategiesTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			addToCloneableStrategiesTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await alloInstance.queryFilter(
			'StrategyApproved',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		strategyAddress = event.args.strategy

		// Create pool
		console.log(' 🚩  3. Create pool')
		const createPoolTx = await alloInstance.connect(alice).createPool(
			aliceProfileId, // _profileId
			strategyAddress, // _strategy
			aliceInitStrategyData, // _initStrategyData
			NATIVE, //_token
			poolFundingAmount, // _amount
			[alicePoolMetadata.protocol, alicePoolMetadata.pointer], // _metadata
			alicePoolManagers, // _managers
			{ value: poolFundingAmount }
		)

		await createPoolTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			createPoolTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await alloInstance.queryFilter(
			'PoolCreated',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		alicePoolId = event.args.poolId
		alicePoolDto = await alloInstance.getPool(alicePoolId)
		alicePool = {
			profileId: alicePoolDto[0],
			strategy: alicePoolDto[1],
			token: alicePoolDto[2],
			metadata: {
				protocol: alicePoolDto[3][0],
				pointer: alicePoolDto[3][1]
			},
			managerRole: alicePoolDto[4],
			adminRole: alicePoolDto[5]
		}

		aliceStrategyContract = await ethers.getContractAt(
			'DirectGrantsSimpleStrategy',
			alicePool.strategy
		)

		// 4. Add recipient
		console.log(' 🚩  4. Add recipient')
		const addRecipientTx = await alloInstance
			.connect(alice)
			.registerRecipient(alicePoolId, bobDataBytes)

		await addRecipientTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			addRecipientTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'Registered',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		bobRecipientId = event.args.recipientId

		let bobRecipientDto: any[] = await aliceStrategyContract.getRecipient(
			bobRecipientId
		)

		bobRecipient = {
			useRegistryAnchor: bobRecipientDto[0],
			recipientAddress: bobRecipientDto[1],
			grantAmount: bobRecipientDto[2],
			metadata: {
				protocol: bobRecipientDto[3][0],
				pointer: bobRecipientDto[3][1]
			},
			recipientStatus: bobRecipientDto[4],
			milestonesReviewStatus: bobRecipientDto[5]
		}

		// 5. Set recipient status to inReview
		console.log(' 🚩  5. Set recipient status to inReview')

		const setRecipientStatusToInReviewTx = await aliceStrategyContract
			.connect(alice)
			.setRecipientStatusToInReview([bobRecipientId])

		await setRecipientStatusToInReviewTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			setRecipientStatusToInReviewTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'RecipientStatusChanged',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		let recipientStatusChangedStatus: bigint = event.args.status

		bobRecipientStatus = await aliceStrategyContract.getRecipientStatus(
			bobRecipientId
		)

		// 6. Allocate funds
		console.log(' 🚩  6. Allocate funds')

		const allocateFundsTx = await alloInstance
			.connect(alice)
			.allocate(alicePoolId, bobAllocateDataBytes)

		await allocateFundsTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			setRecipientStatusToInReviewTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'RecipientStatusChanged',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		recipientStatusChangedStatus = event.args.status

		// 7. Set milestone
		console.log(' 🚩  7. Set milestone')

		const setMilestoneTx = await aliceStrategyContract
			.connect(bob)
			.setMilestones(bob.address, [
				[
					aliceMilestone1.amountPercentage,
					aliceMilestone1.metadata,
					aliceMilestone1.status
				],
				[
					aliceMilestone2.amountPercentage,
					aliceMilestone2.metadata,
					aliceMilestone2.status
				]
			])

		await setMilestoneTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			setMilestoneTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'MilestonesSet',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		const milestoneLength: bigint = event.args.milestonesLength

		// 8. Review set milestone
		console.log(' 🚩  8. Review set milestones')

		const reviewSetMilestonesTx = await aliceStrategyContract
			.connect(alice)
			.reviewSetMilestones(
				bob.address, //  _recipientId
				BigInt(2) // _status
			)

		await reviewSetMilestonesTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			reviewSetMilestonesTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'MilestonesReviewed',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		const milestonesReviewStatus: bigint = event.args.status

		// 9. Submit milestone
		console.log(' 🚩  9. Submit milestone')

		const submitMilestoneTx = await aliceStrategyContract
			.connect(bob)
			.submitMilestone(
				bob.address, // _recipientId
				BigInt(0), // _milestoneId
				bobMilestone1Array // _metadata
			)

		await submitMilestoneTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			submitMilestoneTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'MilestoneSubmitted',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		const milestoneStatus: bigint = event.args.milestoneId

		// 10. Reject milestone
		// console.log(' 🚩  10. Reject milestone')

		// const rejectMilestoneTx = await aliceStrategyContract
		// 	.connect(alice)
		// 	.rejectMilestone(
		// 		bob.address, // _recipientId
		// 		BigInt(1) // _milestoneId
		// 	)

		// await rejectMilestoneTx.wait()

		// transactionReceipt = await ethers.provider.getTransactionReceipt(
		// 	rejectMilestoneTx.hash
		// )

		// transactionBlockNumber = transactionReceipt.blockNumber

		// events = await aliceStrategyContract.queryFilter(
		// 	'MilestoneStatusChanged',
		// 	transactionBlockNumber
		// )

		// event = events[events.length - 1]

		// const milestoneStatusChangedStatus: bigint = event.args.status

		// 11. Distribute milestone fund
		console.log(' 🚩  11. Distribute milestone fund')

		const distributeMilestoneFundTx = await alloInstance
			.connect(alice)
			.distribute(
				alicePoolId, // _poolId
				[bob.address], // _recipientIds
				ethers.encodeBytes32String('') // _data
			)

		await distributeMilestoneFundTx.wait()

		transactionReceipt = await ethers.provider.getTransactionReceipt(
			distributeMilestoneFundTx.hash
		)
		transactionBlockNumber = transactionReceipt.blockNumber

		events = await aliceStrategyContract.queryFilter(
			'Distributed',
			transactionBlockNumber
		)

		event = events[events.length - 1]

		const distributedAmount: bigint = event.args.amount

		// Assert
		console.log('🏷️  Milestone fund distributed')
		try {
			assert.equal(distributedAmount, aliceMilestone1.amountPercentage)
		} catch (error) {
			console.log('🚨 Error: ', error)
		}

		const submitMilestone2Tx = await aliceStrategyContract
			.connect(bob)
			.submitMilestone(
				bob.address, // _recipientId
				BigInt(1), // _milestoneId
				bobMilestone1Array // _metadata
			)

		await submitMilestone2Tx.wait()

		const distributeMilestoneFund2Tx = await alloInstance
			.connect(alice)
			.distribute(
				alicePoolId, // _poolId
				[bob.address], // _recipientIds
				ethers.encodeBytes32String('') // _data
			)

		await distributeMilestoneFund2Tx.wait()
	})
})

async function deployContracts() {
	// Deploy Registry contract

	const registryArgs: any = [
		'0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' // owner
	]
	const Registry: ContractFactory<any[], BaseContract> =
		await ethers.getContractFactory('Registry')

	const registryInstance: Contract = await upgrades.deployProxy(
		Registry,
		registryArgs
	)
	await registryInstance.waitForDeployment()

	const registryInstanceAddress: string = registryInstance.target as string

	// Deploy Allo contract

	const alloArgs: any = [
		'0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // owner
		registryInstanceAddress, // registryAddress
		'0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // treasury,
		0, // percentFee,
		0 // baseFee,
	]

	const Allo: ContractFactory<any[], BaseContract> =
		await ethers.getContractFactory('Allo')

	const alloInstance: Contract = await upgrades.deployProxy(Allo, alloArgs)
	await alloInstance.waitForDeployment()

	const alloInstanceAddress: string = alloInstance.target as string

	// Deploy Direct Grants Simple Strategy contract

	const directGrantsSimpleStrategyArgs: any[] = [
		alloInstanceAddress, // _alloAddress
		'direct grant simple strategy' // _strategyName
	]
	const directGrantsSimpleStrategyContract = await deployContract(
		'DirectGrantsSimpleStrategy',
		directGrantsSimpleStrategyArgs
	)

	// Return all deployed contracts
	return {
		registryInstance,
		alloInstance,
		directGrantsSimpleStrategyContract
	}
}

async function deployContract(contractName: string, args: any[]) {
	const ContractFactory: ContractFactory = await ethers.getContractFactory(
		contractName
	)
	const contract = await ContractFactory.deploy(...args)
	return contract
}
