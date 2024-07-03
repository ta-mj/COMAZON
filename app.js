import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import { PrismaClient , Prisma} from '@prisma/client';
import { assert, create, tuple } from 'superstruct';
import {
  CreateUser,
  PatchUser,
  CreateProduct,
  PatchProduct,
  CreateOrder,
  PatchOrder,
  PostSavedProduct, 
} from './structs.js';

const prisma = new PrismaClient();

const app = express();

app.use(cors());
app.use(express.json());

function asyncHandler(handler) {
  return async function (req, res) {
    try {
      await handler(req, res);
    } catch (e) {
      if (e.name === 'StructError' ||
        e instanceof Prisma.PrismaClientValidationError
      ) {
        res.status(400).send({ message: e.message });
      } else if (e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        res.sendStatus(404);
      } else {
        res.status(500).send({ message: e.message });
      }
    }
  };
}

/*********** users ***********/

app.get('/users', asyncHandler(async (req, res) => {
  //쿼리 파라미터 처리하기
  //offset : 데이터 몇개를 건너뛸지 , limit : 몇개의 데이터를 보여줄지 --> pagination!
  const { offset = 0, limit = 10, order = 'newest' } = req.query;
  let orderBy;
  switch(order){
    case 'oldest':
      orderBy = {createdAt : 'asc'};
      break;
    case 'newest':
    default:
      orderBy = {createdAt : 'desc'};
  }
  const users = await prisma.user.findMany({
    orderBy,
    skip: parseInt(offset),
    take: parseInt(limit),
    include:{
      userPreference:{
        select:{
          receiveEmail: true,
        }
      }
    },
  });
  res.send(users);
}));

app.get('/users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    include:{
      userPreference: true,
    },
  });
  res.send(user);
}));


// 리퀘스트 바디 내용으로 유저 생성
app.post('/users', asyncHandler(async (req, res) => {
  assert(req.body, CreateUser)
  //유저 생성 시 유저 Preference도 함께 생성
  const { userPreference, ...userFields } = req.body;
  const user = await prisma.user.create({
    data : {
      ...userFields,
      userPreference : {
        create: userPreference,
      },
    },
    include:{
      userPreference: true,
    },
  });
  res.status(201).send(user);
}));


// 리퀘스트 바디 내용으로 id에 해당하는 유저 수정
app.patch('/users/:id', asyncHandler(async (req, res) => {
  assert(req.body, PatchUser)
  const { id } = req.params;
  const { userPreference, ...userFields } = req.body;
  const user = await prisma.user.update({
    where: { id },
    data : {
      ...userFields,
      userPreference : {
        update: userPreference,
      },
    },
    include:{
      userPreference: true,
    },
  });
  res.send(user);
}));


// id에 해당하는 유저 삭제
app.delete('/users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.user.delete({
    where : {
      id
    },
  })
  res.sendStatus(204);
}));

//특정 유저의 찜한 상품 가져오기
app.get('/users/:id/saved-products', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { savedProducts } = await prisma.user.findUniqueOrThrow({
    where: { id },
    include:{
      savedProducts: true,
    },
  });
  res.send(savedProducts);
}));

app.post('/users/:id/saved-products', asyncHandler(async (req, res) => {
  assert(req.body, PostSavedProduct);
  const { id: userId } = req.params;
  const { productId } = req.body;
  const { savedProducts } = await prisma.user.update({
    where: { id: userId },
    data: {
      savedProducts: {
        connect: {
          id: productId,
        },
        //연결 해제
        /**
         * disconnect : {
         *  id: productId,
         * }
         */
      },
    },
    include:{
      savedProducts: true,
    },
  });
  res.send(savedProducts);
}));

//특정 유저의 주문 내역 가져오기
app.get('/users/:id/orders', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { orders } = await prisma.user.findUniqueOrThrow({
    where: { id },
    include:{
      orders: true,
    },
  });
  res.send(orders);
}));

/*********** products ***********/

app.get('/products', asyncHandler(async (req, res) => {
  // 상품 목록 조회
  const { order, offset = 0, limit = 10, category } = req.query;
  let orderBy;
  switch(order){
    case 'priceLowest':
      orderBy = { price : 'asc' };
      break;
    case 'priceHighest': 
      orderBy = { price : 'desc' };
      break;
    case 'oldest':
      orderBy = { createdAt : 'asc' };
      break;
    case 'newest':
    default:
      orderBy = { createdAt : 'desc'};
  }
  const products = await prisma.product.findMany({
    where: {
      category,
    },
    orderBy,
    skip: parseInt(offset),
    take: parseInt(limit),
  });
  res.send(products);
}));

app.get('/products/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  // id에 해당하는 상품 조회
  const product = await prisma.product.findUnique({
    where:{id},
  })
  res.send(product);
}));

app.post('/products', asyncHandler(async (req, res) => {
  // 리퀘스트 바디 내용으로 상품 생성
  assert(req.body, CreateProduct);
  const product = await prisma.product.create({
    data : req.body,
  })
  res.status(201).send(product);
}));

app.patch('/products/:id', asyncHandler(async (req, res) => {
  assert(req.body, PatchProduct);
  const { id } = req.params;
  // 리퀘스트 바디 내용으로 id에 해당하는 상품 수정
  const product = await prisma.product.update({
    where:{ id },
    data : req.body,
  })
  res.send(product);
}));

app.delete('/products/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  // id에 해당하는 상품 삭제
  await prisma.product.delete({
    where : { id },
  })
  res.sendStatus(204);
}));


/*********** orders ***********/

app.get('/orders', asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany();
  res.send(orders);
}));

app.get('/orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await prisma.order.findUniqueOrThrow({
    where: { id },
    include: {
      orderItems: true,
    },
  });
  let total = 0;
  //주문의 총 가격을 계산(Computed field)
  order.orderItems.forEach((item) => {
    total += item.quantity * item.unitPrice;
  });
  order.total = total;
  res.send(order);
}));

app.post('/orders', asyncHandler(async (req, res) => {
  assert(req.body, CreateOrder);
  const { orderItems, userId } = req.body;

  const productIds = orderItems.map((orderItem) => orderItem.productId);
  const products = await prisma.product.findMany({
    where: { id : { in: productIds } },
  });

  function getQuantity(productId){
    const orderItem = orderItems.find((orderItem) => orderItem.productId === productId);
    return orderItem.quantity;
  }
  
  const isSufficientStock = products.every((product) => {
    const { id, stock } = product;
    return stock >= getQuantity(id);
  });

  if(!isSufficientStock){
    throw new Error('Insufficient Stock');
  }

  const queries = productIds.map((productId) =>
    prisma.product.update({
      where: { id: productId },
      data: { stock: { decrement: getQuantity(productId) } },
    })
  );

  //하나로 묶여 실행될 query들을 배열 형태로 전달  
  const [order] = await prisma.$transaction([
    prisma.order.create({
      data: {
        userId,
        orderItems : {
          create: orderItems,
        },
      },
      include : {
        orderItems : true,
      },
    }),
    ...queries,
  ]);

  res.status(201).send(order);
}));

app.patch('/orders/:id', asyncHandler(async (req, res) => {
  assert(req.body, PatchOrder);
  const { id } = req.params;
  const order = await prisma.order.update({
    where: { id },
    data: req.body,
  });
  res.send(order);
}));

app.delete('/orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.order.delete({ where: { id } });
  res.sendStatus(204);
}));

app.listen(process.env.PORT || 3000, () => console.log('Server Started'));